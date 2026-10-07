import { z } from 'zod';
import { Customer } from './modules/customers/domain/entities/customer.entity.js';
import { CustomerDocument } from './modules/customers/domain/value-objects/customer-document.value-object.js';
import { Vehicle } from './modules/vehicles/domain/entities/vehicle.entity.js';
import { LicensePlate } from './modules/vehicles/domain/value-objects/license-plate.value-object.js';
import { CustomerSqlRepository, VehicleSqlRepository, customerData, vehicleData } from './identity-repositories.mjs';

const timestamp = z.iso.datetime({ offset: true });
const customerSchema = z.object({ id: z.uuid(), name: z.string(), documentType: z.enum(['CPF', 'CNPJ']), document: z.string(), phone: z.string().nullable(), email: z.string().nullable(), isActive: z.boolean(), createdAt: timestamp, updatedAt: timestamp }).strict();
const vehicleSchema = z.object({ id: z.uuid(), customerId: z.uuid(), licensePlate: z.string(), brand: z.string(), model: z.string(), year: z.number().int().min(1900), isActive: z.boolean(), createdAt: timestamp, updatedAt: timestamp }).strict();

export function validateIdentitySnapshot(snapshot) {
  const data = z.object({ version: z.literal(1), customers: z.array(customerSchema), vehicles: z.array(vehicleSchema) }).strict().parse(snapshot);
  const customerIds = new Set(), documents = new Set(), vehicleIds = new Set(), plates = new Set();
  const customers = data.customers.map(row => {
    const customer = new Customer({ ...row, document: new CustomerDocument(row.document, row.documentType), createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt) });
    if (customerIds.has(customer.id) || documents.has(customer.document.value)) throw new Error('Duplicate customer identity in snapshot');
    customerIds.add(customer.id); documents.add(customer.document.value);
    return customer;
  });
  const vehicles = data.vehicles.map(row => {
    const vehicle = new Vehicle({ ...row, licensePlate: new LicensePlate(row.licensePlate), createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt) });
    if (!customerIds.has(vehicle.customerId)) throw new Error('Vehicle customer is missing from snapshot');
    if (vehicleIds.has(vehicle.id) || plates.has(vehicle.licensePlate.value)) throw new Error('Duplicate vehicle identity in snapshot');
    vehicleIds.add(vehicle.id); plates.add(vehicle.licensePlate.value);
    return vehicle;
  });
  return { customers, vehicles };
}

function identical(existing, expected, serialize) {
  return JSON.stringify(serialize(existing)) === JSON.stringify(serialize(expected));
}
/** Dry run is the default. A conflict aborts the entire import without overwriting target data. */
export async function importIdentitySnapshot(pool, snapshot, { commit = false } = {}) {
  const entities = validateIdentitySnapshot(snapshot);
  const customers = new CustomerSqlRepository(pool), vehicles = new VehicleSqlRepository(pool);
  const client = await pool.connect();
  const result = { commit, customersCreated: 0, vehiclesCreated: 0, customersUnchanged: 0, vehiclesUnchanged: 0 };
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('identity-import',0))");
    for (const customer of entities.customers.sort((a, b) => a.document.value.localeCompare(b.document.value))) {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`customer:${customer.document.value}`]);
      const existing = await customers.findByDocument(customer.document.value, client, true) ?? await customers.findById(customer.id, client);
      if (existing) {
        if (!identical(existing, customer, customerData)) throw new Error('Customer conflicts with target; no data overwritten');
        result.customersUnchanged++;
      } else { await customers.create(customer, client); result.customersCreated++; }
    }
    for (const vehicle of entities.vehicles.sort((a, b) => a.licensePlate.value.localeCompare(b.licensePlate.value))) {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`vehicle:${vehicle.licensePlate.value}`]);
      const existing = await vehicles.findByLicensePlate(vehicle.licensePlate.value, client, true) ?? await vehicles.findById(vehicle.id, client);
      if (existing) {
        if (!identical(existing, vehicle, vehicleData)) throw new Error('Vehicle conflicts with target; no data overwritten');
        result.vehiclesUnchanged++;
      } else { await vehicles.create(vehicle, client); result.vehiclesCreated++; }
    }
    await client.query(commit ? 'COMMIT' : 'ROLLBACK');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
