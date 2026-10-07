import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createHttp } from '../dist/infrastructure/http.mjs';
import { IdentityRegistry, identityRoutes } from '../dist/identity.mjs';
import { CustomerSqlRepository, VehicleSqlRepository, customerData, vehicleData } from '../dist/identity-repositories.mjs';
import { migrateIdentity } from '../dist/identity-schema.mjs';

function repository(kind) {
  const items = new Map();
  return {
    items,
    async create(value) { items.set(value.id, value); },
    async update(value) { items.set(value.id, value); },
    async findById(id) { return items.get(id) ?? null; },
    async findAll() { return [...items.values()]; },
    async findByDocument(document) { return [...items.values()].find(c => c.document.value === document.replace(/\D/g, '')) ?? null; },
    async findByLicensePlate(plate) { return [...items.values()].find(v => v.licensePlate.value === plate) ?? null; },
    kind,
  };
}
const customer = { name: ' Original customer ', documentType: 'CPF', document: '529.982.247-25' };
const vehicle = { licensePlate: 'ABC1D23', brand: 'Toyota', model: 'Corolla', year: 2022 };

test('extracted HTTP contracts: optional contacts, normalized identities, updates, soft deletion and legacy errors', async () => {
  const customers = repository('customers'), vehicles = repository('vehicles');
  const registry = new IdentityRegistry(customers, vehicles);
  const secret = 'legacy-contract-at-least-32-characters';
  const headers = { Authorization: `Bearer ${jwt.sign({ sub: 'admin', role: 'admin' }, secret)}`, 'Content-Type': 'application/json' };
  const app = await createHttp({ service: 'os', store: { ping: async () => {} }, broker: { ready: true }, secret, port: 0, spec: {}, routes: identityRoutes(registry) });
  const base = `http://127.0.0.1:${app.getHttpServer().address().port}`;
  const call = (path, method = 'GET', body) => fetch(base + path, { headers, method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  try {
    const created = await call('/customers', 'POST', customer); assert.equal(created.status, 201);
    const { id } = await created.json();
    assert.match(id, /^[\da-f-]{36}$/);
    const found = await (await call(`/customers/${id}`)).json();
    assert.equal(found.name, 'Original customer'); assert.equal(found.document, '52998224725'); assert.equal(found.email, null);
    assert.equal((await (await call('/customers?document=529.982.247-25')).json()).id, id);
    assert.equal((await (await call('/customers')).json()).length, 1);
    assert.equal((await call(`/customers/${id}`, 'PATCH', { name: 'Updated', email: 'updated@example.com', phone: '11999999999' })).status, 204);
    assert.equal((await call(`/customers/${id}`, 'PATCH', { email: null, phone: null })).status, 204);
    assert.equal((await call(`/customers/${id}`, 'PATCH', { name: ' ' })).status, 422);
    assert.equal((await call('/customers', 'POST', { ...customer, extra: true })).status, 400);
    assert.equal((await call('/customers', 'POST', [])).status, 400);
    assert.equal((await call('/customers', 'POST', null)).status, 400);
    assert.equal((await call('/customers', 'POST', { ...customer, email: 'invalid' })).status, 400);
    assert.equal((await call('/customers', 'POST', { ...customer, document: '11111111111' })).status, 422);
    assert.equal((await call('/customers/missing')).status, 404);
    assert.equal((await call('/customers?document=missing')).status, 404);
    assert.equal((await call('/customers/missing', 'PATCH', {})).status, 404);
    assert.equal((await call('/customers/missing', 'DELETE')).status, 404);
    const createdVehicle = await call('/vehicles', 'POST', { ...vehicle, customerId: id }); assert.equal(createdVehicle.status, 201);
    const vid = (await createdVehicle.json()).id;
    assert.equal((await (await call(`/vehicles/${vid}`)).json()).customerId, id);
    assert.equal((await (await call('/vehicles')).json()).length, 1);
    assert.equal((await call(`/vehicles/${vid}`, 'PATCH', { brand: 'Honda', model: 'Civic', year: 2023 })).status, 204);
    assert.equal((await call(`/vehicles/${vid}`, 'PATCH', { brand: ' ' })).status, 422);
    assert.equal((await call(`/vehicles/${vid}`, 'PATCH', { year: 1899 })).status, 400);
    assert.equal((await call('/vehicles', 'POST', { ...vehicle, customerId: 'invalid' })).status, 400);
    assert.equal((await call('/vehicles/missing')).status, 404);
    assert.equal((await call('/vehicles/missing', 'PATCH', {})).status, 404);
    assert.equal((await call('/vehicles/missing', 'DELETE')).status, 404);
    assert.equal((await call(`/vehicles/${vid}`, 'DELETE')).status, 204);
    assert.equal((await (await call(`/vehicles/${vid}`)).json()).isActive, false);
    assert.equal((await call(`/customers/${id}`, 'DELETE')).status, 204);
    assert.equal((await (await call(`/customers/${id}`)).json()).isActive, false);
    const forbidden = await fetch(base + '/customers', { headers: { Authorization: `Bearer ${jwt.sign({ sub: 'operator', role: 'operator' }, secret)}` } });
    assert.equal(forbidden.status, 403);
  } finally { await app.close(); }
});

test('opening uses existing entities and rejects inactive identities or another owner', async () => {
  const customers = repository('customers'), vehicles = repository('vehicles');
  const registry = new IdentityRegistry(customers, vehicles), queries = [];
  const tx = { query: async (...args) => queries.push(args) };
  const input = { customer: { ...customer, document: '52998224725' }, vehicle };
  const first = await registry.resolveOpening(input, tx);
  assert.equal(first.customer.email, null); assert.equal(first.vehicle.customerId, first.customerId);
  assert.deepEqual(await registry.resolveOpening(input, tx), first);
  const c = customers.items.get(first.customerId), v = vehicles.items.get(first.vehicleId);
  c.deactivate(); await assert.rejects(registry.resolveOpening(input, tx), /inactive customer/); c.isActive = true;
  v.deactivate(); await assert.rejects(registry.resolveOpening(input, tx), /inactive vehicle/); v.isActive = true;
  await assert.rejects(registry.resolveOpening({ ...input, customer: { ...customer, document: '11144477735' } }, tx), /does not belong/);
  assert.ok(queries.every(([sql]) => sql.includes('pg_advisory_xact_lock')));
});

test('PostgreSQL identity adapters map entities, normalize keys, enforce conflicts and missing rows', async () => {
  const registry = new IdentityRegistry(repository('customers'), repository('vehicles'));
  const first = await registry.resolveOpening({ customer: { ...customer, document: '52998224725' }, vehicle }, { query: async () => {} });
  const queries = []; let rows = [], rowCount = 1, fail;
  const pool = { query: async (...args) => { queries.push(args); if (fail) throw fail; return { rows, rowCount }; } };
  const c = new CustomerSqlRepository(pool), v = new VehicleSqlRepository(pool);
  const ce = c.restore(first.customer), ve = v.restore(first.vehicle);
  assert.ok(ce.createdAt instanceof Date); assert.ok(ve.updatedAt instanceof Date);
  assert.equal(c.restore({ ...first.customer, createdAt: undefined, updatedAt: undefined }).isActive, true);
  await c.create(ce); await v.create(ve); await c.update(ce); await v.update(ve);
  assert.equal(await c.findById('missing'), null); assert.equal(await v.findById('missing'), null);
  assert.equal(await c.findByDocument('529.982.247-25'), null); assert.equal(await v.findByLicensePlate('abc-1d23'), null);
  rows = [{ data: customerData(ce) }]; assert.equal((await c.findById(ce.id)).id, ce.id); assert.equal((await c.findByDocument('529.982.247-25', pool, true)).id, ce.id); assert.equal((await c.findAll()).length, 1);
  rows = [{ data: vehicleData(ve) }]; assert.equal((await v.findById(ve.id)).id, ve.id); assert.equal((await v.findByLicensePlate('abc-1d23', pool, true)).id, ve.id); assert.equal((await v.findAll()).length, 1); assert.equal((await v.findByCustomerId(ce.id)).length, 1);
  rowCount = 0; await assert.rejects(c.update(ce), /Customer not found/); await assert.rejects(v.update(ve), /Vehicle not found/);
  fail = { code: '23505' }; await assert.rejects(c.create(ce), /Document already/); await assert.rejects(v.create(ve), /License plate already/);
  fail = { code: '23503' }; await assert.rejects(v.create(ve), /Customer not found/);
  fail = new Error('Disconnected'); await assert.rejects(c.create(ce), /Disconnected/); await assert.rejects(v.create(ve), /Disconnected/);
  assert.ok(queries.some(([sql]) => sql.endsWith('FOR UPDATE')));
});

test('identity schema migration commits or rolls back and always releases connection', async () => {
  const statements = []; let fail = false, releases = 0;
  const pool = { connect: async () => ({ query: async sql => { statements.push(sql); if (fail && sql.startsWith('CREATE')) throw new Error('Migration failed'); }, release: () => releases++ }) };
  await migrateIdentity(pool); assert.equal(statements.at(-1), 'COMMIT');
  fail = true; await assert.rejects(migrateIdentity(pool), /Migration failed/); assert.equal(statements.at(-1), 'ROLLBACK'); assert.equal(releases, 2);
});
