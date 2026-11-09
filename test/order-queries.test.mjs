import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderProjection, orderQueryRoutes } from '../dist/order-queries.mjs';
import { authLookupRoutes } from '../dist/auth-lookup.mjs';

test('legacy reads project frozen snapshots, customer filters and execution duration', async () => {
  const id = 'os-1', data = { orderId: id, status: 'WAITING_PAYMENT', customerId: 'c1', vehicleId: 'v1', createdAt: '2026-01-01T00:00:00Z',
    quote: { amountCents: 25000, servicesAmountCents: 15000, stockItemsAmountCents: 10000, lines: [
      { serviceId: 's1', description: 'Serviço', quantity: 1, unitPriceCents: 15000 },
      { stockItemId: 'p1', description: 'Peça', quantity: 2, unitPriceCents: 5000 }] } };
  const row = orderProjection(id, data, true);
  assert.equal(row.status, 'APPROVED'); assert.equal(row.sagaStatus, 'WAITING_PAYMENT'); assert.equal(row.totalAmount, 250);
  assert.equal(row.stockItems[0].totalPrice, 100); assert.equal(row.services[0].unitPrice, 150);
  assert.equal(orderProjection(id, { status: 'DIAGNOSING' }).totalAmount, null);
  const pages = [];
  const store = { listOrders: async (...page) => { pages.push(page); return [{ id, data }]; }, operationalOrders: async () => [{ id, data }], averageExecutionMinutes: async () => 65 };
  const routes = orderQueryRoutes(store, { customers: { findByDocument: async doc => doc === '52998224725' ? { id: 'c1' } : null } }, { get: async () => data });
  assert.equal((await routes[0].handle({ query: {} })).length, 1);
  assert.equal((await routes[0].handle({ query: { document: '529.982.247-25' } }))[0].stockItems.length, 1);
  await assert.rejects(routes[0].handle({ query: { document: '11144477735' } }), /Customer not found/);
  await assert.rejects(routes[0].handle({ query: { document: 'bad' } }));
  await routes[0].handle({ query: { document: '529.982.247-25', limit: '20', offset: '40' } });
  assert.deepEqual(pages, [[null, 50, 0], ['c1', 50, 0], ['c1', 20, 40]]);
  for (const query of [{ limit: '101' }, { limit: '0' }, { offset: '-1' }, { limit: ['10', '20'] }, { offset: '1.5' }]) {
    await assert.rejects(routes[0].handle({ query }));
  }
  assert.equal((await routes[1].handle())[0].status, 'APPROVED');
  assert.equal((await routes[2].handle()).averageExecutionTimeFormatted, '1h 5m');
  assert.equal((await routes[3].handle({ params: { id } })).services.length, 1);
  assert.ok(routes.every(route => route.roles.includes('admin')));
});
test('internal login lookup is disabled without a token and returns only CPF identity data', async () => {
  assert.deepEqual(authLookupRoutes({}, undefined), []);
  assert.throws(() => authLookupRoutes({}, 'short'));
  const token = 'x'.repeat(32);
  const [route] = authLookupRoutes({ customers: { findByDocument: async doc => doc === '52998224725' ? { id: 'c1', document: { type: 'CPF', value: doc }, isActive: false, email: 'private' } : null } }, token);
  const req = { headers: { authorization: 'Bearer ' + token }, body: { document: '529.982.247-25' } };
  assert.deepEqual(await route.handle(req), { id: 'c1', document: '52998224725', documentType: 'CPF', isActive: false });
  await assert.rejects(route.handle({ ...req, headers: {} }), { status: 401 });
  await assert.rejects(route.handle({ ...req, headers: { authorization: 'Bearer wrong' } }), { status: 401 });
  await assert.rejects(route.handle({ ...req, body: { document: '11144477735' } }), /not found/);
});
