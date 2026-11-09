import { z } from 'zod';
import { NotFoundError } from './infrastructure/contracts.mjs';

const pageSchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional().default(50),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(2147483647)).optional().default(0),
});

export const publicOrderStatus = data => data.legacyStatus ?? ({ DIAGNOSING: 'IN_DIAGNOSIS', QUOTING: 'IN_DIAGNOSIS', WAITING_PAYMENT: 'APPROVED', QUEUING: 'APPROVED' })[data.status] ?? data.status;

export function orderProjection(id, data, details = false) {
  const result = { id, customerId: data.customerId, vehicleId: data.vehicleId, status: publicOrderStatus(data), sagaStatus: data.status,
    diagnosis: typeof data.diagnosis === 'string' ? data.diagnosis : data.diagnosis?.diagnosis ?? null,
    servicesAmount: data.quote?.servicesAmountCents == null ? null : data.quote.servicesAmountCents / 100,
    stockItemsAmount: data.quote?.stockItemsAmountCents == null ? null : data.quote.stockItemsAmountCents / 100,
    totalAmount: data.quote?.amountCents == null ? null : data.quote.amountCents / 100,
    createdAt: data.createdAt, updatedAt: data.updatedAt ?? data.createdAt,
    startedAt: data.startedAt ?? null, finishedAt: data.finishedAt ?? null, deliveredAt: data.deliveredAt ?? null, readOnly: Boolean(data.readOnly) };
  if (!details) return result;
  const lines = data.quote?.lines ?? [];
  const shape = (line, index) => ({ id: line.id ?? `${id}:${index}`, ...(line.serviceId ? { serviceId: line.serviceId } : {}), ...(line.stockItemId ? { stockItemId: line.stockItemId } : {}), name: line.description, quantity: line.quantity, unitPrice: line.unitPriceCents / 100, totalPrice: line.quantity * line.unitPriceCents / 100 });
  const items = lines.map(shape);
  return { ...result, services: items.filter(item => !item.stockItemId), stockItems: items.filter(item => item.stockItemId) };
}
export function orderQueryRoutes(store, identity, service) {
  return [
    { method: 'get', path: '/service-orders', roles: ['admin'], handle: async req => {
      const { limit, offset } = pageSchema.parse(req.query);
      if (req.query.document === undefined) return (await store.listOrders(null, limit, offset)).map(({ id, data }) => orderProjection(id, data));
      const doc = z.string().max(30).transform(value => value.replace(/\D/g, '')).pipe(z.string().regex(/^(?:\d{11}|\d{14})$/)).parse(req.query.document);
      const customer = await identity.customers.findByDocument(doc);
      if (!customer) throw new NotFoundError('Customer not found.');
      return (await store.listOrders(customer.id, limit, offset)).map(({ id, data }) => orderProjection(id, data, true));
    } },
    { method: 'get', path: '/service-orders/operational-queue', roles: ['admin'], handle: async () => (await store.operationalOrders()).map(({ id, data }) => orderProjection(id, data)) },
    { method: 'get', path: '/service-orders/metrics/average-execution-time', roles: ['admin'], handle: async () => {
      const averageExecutionTimeInMinutes = await store.averageExecutionMinutes();
      return { averageExecutionTimeInMinutes, averageExecutionTimeFormatted: `${Math.floor(averageExecutionTimeInMinutes / 60)}h ${averageExecutionTimeInMinutes % 60}m` };
    } },
    { method: 'get', path: '/service-orders/:id/legacy-details', roles: ['admin'], handle: async (req, principal) => orderProjection(req.params.id, await service.get(req.params.id, principal), true) },
  ];
}
