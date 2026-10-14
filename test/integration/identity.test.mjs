import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PostgresStore } from '../../dist/infrastructure/postgres-store.mjs';
import { CustomerSqlRepository, VehicleSqlRepository } from '../../dist/identity-repositories.mjs';
import { IdentityRegistry } from '../../dist/identity.mjs';
import { migrateIdentity } from '../../dist/identity-schema.mjs';
import { OsService } from '../../dist/service.mjs';
import { fingerprint } from '../../dist/infrastructure/contracts.mjs';
import { importIdentitySnapshot } from '../../dist/identity-import.mjs';

function cpf() {
  let digits = String(Math.floor(Math.random() * 900000000) + 100000000);
  for (const factor of [10, 11]) {
    const rest = [...digits].reduce((sum, digit, i) => sum + Number(digit) * (factor - i), 0) * 10 % 11;
    digits += rest === 10 ? '0' : String(rest);
  }
  return digits;
}
test('real PostgreSQL: identities and OS share atomic transaction, concurrent opening and inactive rules', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const store = new PostgresStore(process.env.TEST_DATABASE_URL); await store.init();
  try {
    await migrateIdentity(store.pool);
    const customers = new CustomerSqlRepository(store.pool), vehicles = new VehicleSqlRepository(store.pool);
    const service = new OsService(store, { identity: new IdentityRegistry(customers, vehicles) });
    const doc = cpf(), otherDoc = cpf();
    const plate = [...randomUUID().replace(/-/g, '').slice(0, 3)].map(c => String.fromCharCode(65 + parseInt(c, 16))).join('') + String(Math.floor(Math.random() * 9000) + 1000);
    const input = { customer: { name: 'Original integration', documentType: 'CPF', document: doc }, vehicle: { licensePlate: plate, brand: 'Fiat', model: 'Uno', year: 2020 } };
    const principal = { sub: `integration-${randomUUID()}`, role: 'admin' };
    const opened = await Promise.all(['opening-first', 'opening-second'].map(key => service.open(input, principal, key)));
    const [a, b] = await Promise.all(opened.map(({ id }) => store.get(id)));
    assert.equal(a.customerId, b.customerId); assert.equal(a.vehicleId, b.vehicleId);
    assert.equal((await store.pool.query('SELECT count(*)::int AS n FROM customers WHERE document=$1', [doc])).rows[0].n, 1);
    assert.equal((await store.pool.query('SELECT count(*)::int AS n FROM vehicles WHERE plate=$1', [plate])).rows[0].n, 1);
    assert.equal((await service.open(input, principal, 'opening-first')).id, opened[0].id);
    const c = await customers.findById(a.customerId), v = await vehicles.findById(a.vehicleId);
    assert.equal((await vehicles.findByCustomerId(c.id)).length, 1);
    await assert.rejects(customers.create(c), /Customer ID already/);
    await assert.rejects(customers.create(customers.restore({ ...c, id: randomUUID(), document: c.document.value, documentType: c.document.type })), /Document already/);
    await assert.rejects(vehicles.create(v), /License plate already/);
    const snapshot = JSON.stringify(c);
    await migrateIdentity(store.pool); assert.equal(JSON.stringify(await customers.findById(c.id)), snapshot);
    const totals = async () => {
      const ids = ['opening-first', 'opening-second', 'wrong-customer', 'inactive-customer', 'inactive-vehicle'].map(key => `os-${fingerprint({ owner: principal.sub, key }).slice(0, 32)}`);
      const result = await store.pool.query('SELECT (SELECT count(*)::int FROM aggregates WHERE id=ANY($1)) AS orders,(SELECT count(*)::int FROM inbox WHERE aggregate_id=ANY($1)) AS inbox,(SELECT count(*)::int FROM outbox WHERE aggregate_id=ANY($1)) AS outbox', [ids]);
      return result.rows[0];
    };
    const before = await totals();
    await assert.rejects(service.open({ ...input, customer: { ...input.customer, document: otherDoc } }, principal, 'wrong-customer'), /does not belong/);
    assert.equal(await customers.findByDocument(otherDoc), null); assert.deepEqual(await totals(), before);
    c.deactivate(); await customers.update(c);
    await assert.rejects(service.open(input, principal, 'inactive-customer'), /inactive customer/); assert.deepEqual(await totals(), before);
    c.isActive = true; await customers.update(c);
    v.deactivate(); await vehicles.update(v);
    await assert.rejects(service.open(input, principal, 'inactive-vehicle'), /inactive vehicle/); assert.deepEqual(await totals(), before);
    v.isActive = true; await vehicles.update(v);
  } finally { await store.close(); }
});

test('real PostgreSQL: legacy import defaults to rollback, preserves UUIDs and rejects conflicts atomically', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const store = new PostgresStore(process.env.TEST_DATABASE_URL); await store.init();
  try {
    await migrateIdentity(store.pool);
    const customers = new CustomerSqlRepository(store.pool), vehicles = new VehicleSqlRepository(store.pool);
    const id = randomUUID(), vehicleId = randomUUID();
    const plate = [...randomUUID().replace(/-/g, '').slice(0, 3)].map(c => String.fromCharCode(65 + parseInt(c, 16))).join('') + String(Math.floor(Math.random() * 9000) + 1000);
    const c = { id, name: 'Imported original', documentType: 'CPF', document: cpf(), phone: null, email: null, isActive: false, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-02-01T00:00:00.000Z' };
    const v = { id: vehicleId, customerId: id, licensePlate: plate, brand: 'Fiat', model: 'Uno', year: 2020, isActive: false, createdAt: c.createdAt, updatedAt: c.updatedAt };
    const snapshot = { version: 1, customers: [c], vehicles: [v] };
    assert.deepEqual(await importIdentitySnapshot(store.pool, snapshot), { commit: false, customersCreated: 1, vehiclesCreated: 1, customersUnchanged: 0, vehiclesUnchanged: 0 });
    assert.equal(await customers.findById(id), null); assert.equal(await vehicles.findById(vehicleId), null);
    await importIdentitySnapshot(store.pool, snapshot, { commit: true });
    assert.equal((await customers.findById(id)).isActive, false); assert.equal((await vehicles.findById(vehicleId)).customerId, id);
    assert.equal((await vehicles.findById(vehicleId)).createdAt.toISOString(), c.createdAt);
    assert.deepEqual(await importIdentitySnapshot(store.pool, snapshot, { commit: true }), { commit: true, customersCreated: 0, vehiclesCreated: 0, customersUnchanged: 1, vehiclesUnchanged: 1 });
    const fresh = { ...c, id: randomUUID(), document: cpf() };
    await assert.rejects(importIdentitySnapshot(store.pool, { ...snapshot, customers: [c, fresh], vehicles: [{ ...v, brand: 'Conflicting change' }] }, { commit: true }), /Vehicle conflicts/);
    assert.equal(await customers.findById(fresh.id), null); assert.equal((await vehicles.findById(vehicleId)).brand, 'Fiat');
    await assert.rejects(importIdentitySnapshot(store.pool, { ...snapshot, customers: [{ ...c, id: randomUUID() }], vehicles: [] }, { commit: true }), /Customer conflicts/);
    const differentDocument = cpf();
    await assert.rejects(importIdentitySnapshot(store.pool, { ...snapshot, customers: [{ ...c, document: differentDocument }], vehicles: [] }, { commit: true }), /Customer conflicts/);
    assert.equal(await customers.findByDocument(differentDocument), null);
    const client = await store.pool.connect();
    try {
      await client.query('BEGIN');
      const originalCustomer = await customers.findById(id, client), originalVehicle = await vehicles.findById(vehicleId, client);
      originalCustomer.name = 'Rolled-back update'; originalVehicle.brand = 'Rolled-back update';
      await customers.update(originalCustomer, client); await vehicles.update(originalVehicle, client);
      assert.equal((await customers.findById(id, client)).name, 'Rolled-back update');
      await client.query('ROLLBACK');
      assert.equal((await customers.findById(id)).name, c.name); assert.equal((await vehicles.findById(vehicleId)).brand, v.brand);
    } finally { client.release(); }
    const existingVehicle = await vehicles.findById(vehicleId);
    const collidingVehicle = vehicles.restore({ ...v, licensePlate: plate.slice(0, 3) + (plate.slice(3) === '9999' ? '1000' : '9999') });
    await assert.rejects(vehicles.create(collidingVehicle), /Vehicle ID already/);
    assert.equal((await vehicles.findById(existingVehicle.id)).licensePlate.value, plate);
  } finally { await store.close(); }
});
