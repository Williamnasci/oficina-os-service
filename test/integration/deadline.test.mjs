import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PostgresStore } from '../../dist/infrastructure/postgres-store.mjs';
import { OsService } from '../../dist/service.mjs';
import { openSaga } from '../../dist/saga.js';

test('expired old Saga is compensated even behind 501 newer aggregates', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const store = new PostgresStore(process.env.TEST_DATABASE_URL); await store.init();
  try {
    const id = randomUUID(), prefix = randomUUID();
    await store.transact(id, 'opening', 'opening', async () => ({ data: { ...openSaga(id).saga, deadline: 1 } }));
    await store.pool.query(`INSERT INTO aggregates(id,version,data,updated_at)
      SELECT $1 || n,0,jsonb_build_object('status','FINISHED'),now() + interval '5 minutes'
      FROM generate_series(1,501) AS n`, [prefix]);
    assert.ok(!(await store.list()).some(row => row.id === id));
    const service = new OsService(store, { now: () => 2 });
    await service.expire();
    assert.equal((await store.get(id)).status, 'CANCELLING_EXECUTION');
    assert.equal((await store.get(id)).deadline, null);
    await service.expire();
    const emitted = await store.pool.query('SELECT envelope FROM outbox WHERE aggregate_id=$1', [id]);
    assert.equal(emitted.rowCount, 1); assert.equal(emitted.rows[0].envelope.type, 'CancelExecution');
  } finally { await store.close(); }
});
