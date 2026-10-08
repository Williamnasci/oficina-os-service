import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateIdentitySnapshot, importIdentitySnapshot } from '../dist/identity-import.mjs';

const snapshot = {
  version: 1,
  customers: [{ id: '7f74181d-bcb7-419d-b104-c9ab78baad19', name: 'Original', documentType: 'CPF', document: '529.982.247-25', email: null, phone: null, isActive: false, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-02-01T00:00:00Z' }],
  vehicles: [{ id: '4930efb3-1e4d-4f42-bc59-71b6a787b7e6', customerId: '7f74181d-bcb7-419d-b104-c9ab78baad19', licensePlate: 'abc-1234', brand: 'Fiat', model: 'Uno', year: 2020, isActive: false, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-02-01T00:00:00Z' }],
};
test('legacy snapshots retain UUIDs, inactivity, dates and owner, and reject ambiguity before connecting', async () => {
  const imported = validateIdentitySnapshot(snapshot);
  assert.equal(imported.customers[0].id, snapshot.customers[0].id); assert.equal(imported.customers[0].isActive, false);
  assert.equal(imported.vehicles[0].id, snapshot.vehicles[0].id); assert.equal(imported.vehicles[0].customerId, snapshot.customers[0].id);
  assert.equal(imported.customers[0].document.value, '52998224725'); assert.equal(imported.vehicles[0].licensePlate.value, 'ABC1234');
  assert.equal(imported.customers[0].createdAt.toISOString(), '2025-01-01T00:00:00.000Z');
  for (const change of [
    data => data.customers.push({ ...data.customers[0] }),
    data => data.vehicles.push({ ...data.vehicles[0] }),
    data => { data.customers = []; },
    data => { data.customers[0].document = '11111111111'; },
    data => { data.customers[0].createdAt = 'unknown'; },
    data => { data.vehicles[0].licensePlate = 'invalid'; },
    data => { data.version = 2; },
  ]) {
    const invalid = structuredClone(snapshot); change(invalid);
    await assert.rejects(importIdentitySnapshot({ connect: () => { throw new Error('Must not connect'); } }, invalid), error => error.message !== 'Must not connect');
  }
});
