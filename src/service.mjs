import { z } from 'zod';
import { openSaga, advance } from './saga.ts';
import { normalizeDocument, normalizePlate } from './customer.ts';
import { message, fingerprint, ConflictError, NotFoundError, RetryableError } from './infrastructure/contracts.mjs';
import { assertOwner } from './infrastructure/http.mjs';

const openingSchema = z.object({
  customer: z.object({ name: z.string().trim().min(1).max(200), documentType: z.enum(['CPF', 'CNPJ']), document: z.string().max(30), email: z.email(), phone: z.string().max(30).optional() }).strict(),
  vehicle: z.object({ licensePlate: z.string().max(20), brand: z.string().min(1), model: z.string().min(1), year: z.number().int().min(1900).max(2100) }).strict(),
  services: z.array(z.object({ serviceId: z.string().min(1), quantity: z.number().int().positive() })).default([]),
  stockItems: z.array(z.object({ stockItemId: z.string().min(1), quantity: z.number().int().positive() })).default([]),
}).strict();

export class OsService {
  constructor(store, { now = () => Date.now(), timeoutMs = 86400000 } = {}) { Object.assign(this, { store, now, timeoutMs }); }
  deadline(status) { return ['DIAGNOSING', 'QUOTING', 'WAITING_APPROVAL', 'WAITING_PAYMENT', 'QUEUING'].includes(status) ? this.now() + this.timeoutMs : null; }
  async open(body, principal, key) {
    const input = openingSchema.parse(body);
    input.customer.document = normalizeDocument(input.customer.document, input.customer.documentType);
    input.vehicle.licensePlate = normalizePlate(input.vehicle.licensePlate);
    if (!key || !/^[a-zA-Z0-9-]{8,100}$/.test(key)) throw new Error('Idempotency-Key is required (8-100 letters, digits or hyphens)');
    if (!['admin', 'operator'].includes(principal.role) && principal.document !== input.customer.document) throw Object.assign(new Error('Forbidden'), { status: 403 });
    const orderId = `os-${fingerprint({ owner: principal.sub, key }).slice(0, 32)}`;
    const result = await this.store.transact(orderId, key, fingerprint(input), async (existing, tx) => {
      if (existing) throw new ConflictError('Order already exists');
      const customerId = `customer-${input.customer.document}`;
      if (tx) {
        await tx.query('INSERT INTO customers(id,document,data) VALUES($1,$2,$3) ON CONFLICT(document) DO NOTHING', [customerId, input.customer.document, input.customer]);
        const vehicle = await tx.query('SELECT customer_id FROM vehicles WHERE plate=$1 FOR UPDATE', [input.vehicle.licensePlate]);
        if (vehicle.rowCount && vehicle.rows[0].customer_id !== customerId) throw new ConflictError('Vehicle belongs to another customer');
        const registered = await tx.query('INSERT INTO vehicles(plate,customer_id,data) VALUES($1,$2,$3) ON CONFLICT(plate) DO UPDATE SET plate=EXCLUDED.plate RETURNING customer_id', [input.vehicle.licensePlate, customerId, input.vehicle]);
        if (registered.rows[0]?.customer_id !== customerId) throw new ConflictError('Vehicle belongs to another customer');
      }
      const { saga } = openSaga(orderId);
      const seed = { id: `${orderId}:opened`, orderId };
      const data = { ...saga, ...input, owner: principal.sub, customerId, createdAt: new Date(this.now()).toISOString(), deadline: this.deadline(saga.status) };
      return { data, messages: [message(seed, 'os', 'execution', 'StartDiagnosis', { owner: data.owner, customer: data.customer, vehicle: data.vehicle, services: data.services, stockItems: data.stockItems })] };
    });
    return { id: orderId, status: result.data.status };
  }
  async get(id, principal) { const data = await this.store.get(id); if (!data) throw new NotFoundError('Order not found'); assertOwner(data, principal); return data; }
  async consume(event) {
    const allowed = event.source === 'billing'
      ? ['QuoteCreated', 'QuoteApproved', 'QuoteRejected', 'CheckoutCreated', 'PaymentApproved', 'BillingCompensated', 'StepFailed', 'CompensationFailed']
      : event.source === 'execution' ? ['DiagnosisCompleted', 'ExecutionStarted', 'ExecutionFinished', 'ExecutionCancelled', 'StepFailed', 'CompensationFailed'] : ['DeadlineExpired'];
    if (!allowed.includes(event.type)) throw new Error('Invalid event producer or type');
    return this.store.transact(event.orderId, event.id, fingerprint({ source: event.source, type: event.type, payload: event.payload }), async data => {
      if (!data) throw new RetryableError('Order not found yet');
      if (event.type === 'CheckoutCreated') return { data: { ...data, checkout: event.payload } };
      if (event.type === 'PaymentApproved' && ['CANCELLING_EXECUTION', 'COMPENSATING_BILLING', 'COMPENSATED'].includes(data.status)) {
        return { data, messages: [message(event, 'os', 'billing', 'RefundLatePayment', event.payload)] };
      }
      const result = advance(data, event, data.version);
      const next = { ...data, ...result.saga, deadline: this.deadline(result.saga.status) };
      if (event.type === 'DiagnosisCompleted') next.diagnosis = event.payload;
      if (event.type === 'QuoteCreated') next.quote = event.payload;
      if (event.type === 'PaymentApproved') next.paymentId = event.payload.paymentId;
      if (event.type === 'StepFailed' || event.type === 'CompensationFailed') next.failure = event.payload;
      const messages = result.commands.map(command => message(event, 'os', command.target, command.type, {
        ...(command.type === 'CreateQuote' ? { ...next.diagnosis, owner: next.owner, customer: next.customer } : {}),
        ...(command.type === 'QueueExecution' ? { paymentId: next.paymentId } : {}),
      }));
      return { data: next, messages };
    });
  }
  async deliver(id, principal, key) {
    await this.get(id, principal);
    return this.consumeLocal(id, 'OrderDelivered', key);
  }
  async consumeLocal(id, type, key) {
    return this.store.transact(id, key, type, async data => {
      if (!data) throw new NotFoundError('Order not found');
      const result = advance(data, { id: key, orderId: id, type }, data.version);
      return { data: { ...data, ...result.saga, deadline: null } };
    });
  }
  async expire() {
    for (const { id, data } of await this.store.list()) {
      if (data.deadline && data.deadline <= this.now()) {
        await this.consume(message({ id: `${id}:deadline:${data.version}`, orderId: id }, 'os', 'os', 'DeadlineExpired', { stage: data.status }));
      }
    }
  }
}

export function osRoutes(service) {
  return [
    { method: 'post', path: '/service-orders/opening', status: 201, handle: (req, principal) => service.open(req.body, principal, req.headers['idempotency-key']) },
    { method: 'get', path: '/service-orders/:id', handle: (req, principal) => service.get(req.params.id, principal) },
    { method: 'get', path: '/service-orders/:id/status', handle: async (req, principal) => { const data = await service.get(req.params.id, principal); return { id: req.params.id, status: data.status, history: data.history }; } },
    { method: 'post', path: '/service-orders/:id/deliver', roles: ['admin', 'operator'], handle: async (req, principal) => (await service.deliver(req.params.id, principal, `${req.params.id}:delivered`)).data },
  ];
}
