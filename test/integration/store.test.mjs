import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PostgresStore } from '../../src/infrastructure/postgres-store.mjs';

test('real database: concurrent updates, inbox deduplication, outbox commit and restart', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  let store = new PostgresStore(process.env.TEST_DATABASE_URL); await store.init();
  const id = `integration-${randomUUID()}`;
  try {
    await store.transact(id, 'opening', 'opening', async () => ({ data: { count: 0 }, messages: [{ id: `${id}:out`, orderId: id }] }));
    await Promise.all(Array.from({ length: 10 }, (_, index) => store.transact(id, `increment-${index}`, 'increment', async data => ({ data: { count: data.count + 1 } }))));
    assert.equal((await store.get(id)).count, 10);
    await store.transact(id, 'increment-1', 'increment', async () => { throw new Error('Duplicate must not execute'); });
    await assert.rejects(store.transact(id, 'increment-1', 'different-content', async () => ({ data: {} })), /Idempotency/);
    await assert.rejects(store.transact(id, 'failed', 'failed', async () => { throw new Error('Abort local transaction'); }));
    assert.equal((await store.get(id)).count, 10);
    assert.ok((await store.pending()).some(item => item.id === `${id}:out`));
    await store.close(); store = new PostgresStore(process.env.TEST_DATABASE_URL); await store.init();
    assert.equal((await store.get(id)).count, 10);
    await store.markSent(`${id}:out`); assert.ok(!(await store.pending()).some(item => item.id === `${id}:out`));
  } finally { await store.close(); }
});

test('real database: pages orders deterministically and applies the customer filter before pagination', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const store = new PostgresStore(process.env.TEST_DATABASE_URL);
  const group = randomUUID();
  const customer = 'customer-' + group;
  const orders = [0, 1, 2].map(index => 'order-' + group + '-' + index);
  try {
    await store.init();
    for (const [index, id] of orders.entries()) {
      await store.transact(id, 'open', 'open', async () => ({ data: {
        orderId: id, customerId: index === 1 ? 'another-' + group : customer, createdAt: '9999-01-01T00:00:00.000Z',
      } }));
    }
    await store.transact(group, 'open', 'open', async () => ({ data: { customerId: customer } }));
    assert.deepEqual((await store.listOrders(null, 2, 0)).map(row => row.id), orders.slice(0, 2));
    assert.deepEqual((await store.listOrders(customer, 1, 0)).map(row => row.id), [orders[0]]);
    assert.deepEqual((await store.listOrders(customer, 1, 1)).map(row => row.id), [orders[2]]);
    assert.deepEqual(await store.listOrders(customer, 1, 2), []);
  } finally {
    await store.close();
  }
});
