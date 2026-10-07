import { ConflictException, NotFoundException } from '@nestjs/common';
import { Customer } from './modules/customers/domain/entities/customer.entity.js';
import { CustomerDocument } from './modules/customers/domain/value-objects/customer-document.value-object.js';
import { Vehicle } from './modules/vehicles/domain/entities/vehicle.entity.js';
import { LicensePlate } from './modules/vehicles/domain/value-objects/license-plate.value-object.js';

export const customerData = customer => ({ id: customer.id, name: customer.name, documentType: customer.document.type, document: customer.document.value, phone: customer.phone, email: customer.email, isActive: customer.isActive, createdAt: customer.createdAt, updatedAt: customer.updatedAt });
export const vehicleData = vehicle => ({ id: vehicle.id, customerId: vehicle.customerId, licensePlate: vehicle.licensePlate.value, brand: vehicle.brand, model: vehicle.model, year: vehicle.year, isActive: vehicle.isActive, createdAt: vehicle.createdAt, updatedAt: vehicle.updatedAt });
const dates = data => ({ ...data, createdAt: data.createdAt ? new Date(data.createdAt) : undefined, updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined });

export class CustomerSqlRepository {
  constructor(pool) { this.pool = pool; }
  restore(data) { return new Customer({ ...dates(data), document: CustomerDocument.restore(data.document, data.documentType) }); }
  async create(customer, tx = this.pool) {
    try { await tx.query('INSERT INTO customers(id,document,data) VALUES($1,$2,$3)', [customer.id, customer.document.value, customerData(customer)]); }
    catch (error) { if (error.code === '23505') throw new ConflictException('Document already registered.'); throw error; }
  }
  async findById(id, tx = this.pool) { const result = await tx.query('SELECT data FROM customers WHERE id=$1', [id]); return result.rows[0] ? this.restore(result.rows[0].data) : null; }
  async findByDocument(document, tx = this.pool, lock = false) { const result = await tx.query(`SELECT data FROM customers WHERE document=$1${lock ? ' FOR UPDATE' : ''}`, [document.replace(/\D/g, '')]); return result.rows[0] ? this.restore(result.rows[0].data) : null; }
  async findAll() { return (await this.pool.query("SELECT data FROM customers ORDER BY data->>'createdAt' DESC,id")).rows.map(row => this.restore(row.data)); }
  async update(customer) {
    const result = await this.pool.query('UPDATE customers SET data=$2 WHERE id=$1', [customer.id, customerData(customer)]);
    if (!result.rowCount) throw new NotFoundException('Customer not found.');
  }
}

export class VehicleSqlRepository {
  constructor(pool) { this.pool = pool; }
  restore(data) { return new Vehicle({ ...dates(data), licensePlate: new LicensePlate(data.licensePlate) }); }
  async create(vehicle, tx = this.pool) {
    try { await tx.query('INSERT INTO vehicles(id,plate,customer_id,data) VALUES($1,$2,$3,$4)', [vehicle.id, vehicle.licensePlate.value, vehicle.customerId, vehicleData(vehicle)]); }
    catch (error) {
      if (error.code === '23505') throw new ConflictException('License plate already registered.');
      if (error.code === '23503') throw new NotFoundException('Customer not found.');
      throw error;
    }
  }
  async findById(id, tx = this.pool) { const result = await tx.query('SELECT data FROM vehicles WHERE id=$1', [id]); return result.rows[0] ? this.restore(result.rows[0].data) : null; }
  async findByLicensePlate(plate, tx = this.pool, lock = false) { const result = await tx.query(`SELECT data FROM vehicles WHERE plate=$1${lock ? ' FOR UPDATE' : ''}`, [plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()]); return result.rows[0] ? this.restore(result.rows[0].data) : null; }
  async findAll() { return (await this.pool.query("SELECT data FROM vehicles ORDER BY data->>'createdAt' DESC,id")).rows.map(row => this.restore(row.data)); }
  async findByCustomerId(id) { return (await this.pool.query("SELECT data FROM vehicles WHERE customer_id=$1 ORDER BY data->>'createdAt' DESC,id", [id])).rows.map(row => this.restore(row.data)); }
  async update(vehicle) { const result = await this.pool.query('UPDATE vehicles SET data=$2 WHERE id=$1', [vehicle.id, vehicleData(vehicle)]); if (!result.rowCount) throw new NotFoundException('Vehicle not found.'); }
}
