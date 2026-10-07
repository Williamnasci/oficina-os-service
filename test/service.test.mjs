import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OsService, osRoutes } from '../dist/service.mjs';
import { normalizeDocument, normalizePlate } from '../dist/customer.js';
import { message } from '../dist/infrastructure/contracts.mjs';
import { MemoryStore } from './helpers.mjs';

const principal = { sub: 'operator', role: 'operator' };
const opening = { customer: { name: 'Cliente', documentType: 'CPF', document: '529.982.247-25', email: 'client@example.com' }, vehicle: { licensePlate: 'abc-1234', brand: 'Fiat', model: 'Uno', year: 2020 } };
function event(id, type, payload = {}, source = 'billing') { return message({ id: type, orderId: id }, source, 'os', type, payload); }
test('opening preserves document/plate validation and idempotency with payload conflict', async () => {
  const store = new MemoryStore(); const service = new OsService(store);
  await assert.rejects(service.open(opening, principal, ''), /Idempotency/);
  await assert.rejects(service.open(opening, { sub: 'other', document: '11111111111' }, 'request-1'), { status: 403 });
  const first = await service.open(opening, principal, 'request-1');
  assert.equal((await service.open(opening, principal, 'request-1')).id, first.id);
  await assert.rejects(service.open({ ...opening, customer: { ...opening.customer, name: 'Changed' } }, principal, 'request-1'), /Idempotency/);
  assert.equal(store.outbox.length, 1); assert.equal((await service.get(first.id, principal)).vehicle.licensePlate, 'ABC1234');
  await assert.rejects(service.get('missing', principal), /not found/);
  await assert.rejects(service.get(first.id, { sub: 'other' }), { status: 403 });
  assert.equal(normalizeDocument('11.222.333/0001-81', 'CNPJ'), '11222333000181');
  for (const [value, type] of [['11111111111', 'CPF'], ['52998224724', 'CPF'], ['0000', 'CNPJ'], ['11222333000182', 'CNPJ']]) assert.throws(() => normalizeDocument(value, type));
  assert.equal(normalizePlate('abc1a23'), 'ABC1A23'); assert.throws(() => normalizePlate('invalid'));
});
test('Saga uses broker events, stores history and rejects untrusted producer', async () => {
  const service = new OsService(new MemoryStore()); const { id } = await service.open(opening, principal, 'request-2');
  await assert.rejects(service.consume(event(id, 'DiagnosisCompleted', {}, 'billing')), /producer/);
  await assert.rejects(service.consume(event('missing', 'QuoteCreated')), /not found/);
  await service.consume(event(id, 'DiagnosisCompleted', { diagnosis: 'Trocar filtro', lines: [{ quantity: 1, unitPriceCents: 100 }] }, 'execution'));
  await service.consume(event(id, 'QuoteCreated', { amountCents: 100 }));
  await service.consume(event(id, 'QuoteApproved'));
  await service.consume(event(id, 'CheckoutCreated', { url: 'test' }));
  await service.consume(event(id, 'PaymentApproved', { paymentId: 'mp-1' }));
  await service.consume(event(id, 'ExecutionStarted', {}, 'execution'));
  await service.consume(event(id, 'ExecutionFinished', {}, 'execution'));
  await service.deliver(id, principal, 'delivery');
  const data = await service.get(id, principal); assert.equal(data.status, 'DELIVERED'); assert.equal(data.paymentId, 'mp-1');
  await assert.rejects(service.consumeLocal('missing', 'OrderDelivered', 'd'), /not found/);
  await assert.rejects(service.consume(event(id, 'Bad', {}, 'os')), /producer/);
});
test('durable deadline initiates compensation, late payment requests refund, failed compensation alerts', async () => {
  let now = 0; const store = new MemoryStore(); const service = new OsService(store, { now: () => now, timeoutMs: 100 });
  const { id } = await service.open(opening, principal, 'request-3'); await service.expire(); assert.equal((await store.get(id)).status, 'DIAGNOSING');
  now = 101; await service.expire(); assert.equal((await store.get(id)).status, 'CANCELLING_EXECUTION');
  await service.consume(event(id, 'PaymentApproved', { paymentId: 'late' })); assert.equal(store.outbox.at(-1).type, 'RefundLatePayment');
  await service.consume(event(id, 'CompensationFailed')); assert.equal((await store.get(id)).status, 'MANUAL_INTERVENTION');
});
test('OS routes enforce reads, opening and operational delivery', async () => {
  const service = new OsService(new MemoryStore()); const routes = osRoutes(service);
  const order = await routes[0].handle({ body: opening, headers: { 'idempotency-key': 'request-4' } }, principal);
  const req = { params: { id: order.id } }; assert.equal((await routes[1].handle(req, principal)).status, 'DIAGNOSING');
  assert.equal((await routes[2].handle(req, principal)).history.length, 0);
  await assert.rejects(routes[3].handle(req, principal));
});
