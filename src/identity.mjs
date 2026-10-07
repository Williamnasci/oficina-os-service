import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Customer } from './modules/customers/domain/entities/customer.entity.js';
import { CustomerDocument } from './modules/customers/domain/value-objects/customer-document.value-object.js';
import { Vehicle } from './modules/vehicles/domain/entities/vehicle.entity.js';
import { LicensePlate } from './modules/vehicles/domain/value-objects/license-plate.value-object.js';
import { DomainException } from './shared/domain/errors/domain.exception.js';
import { CreateCustomerUseCase } from './modules/customers/application/use-cases/create-customer.use-case.js';
import { GetCustomerUseCase } from './modules/customers/application/use-cases/get-customer.use-case.js';
import { ListCustomersUseCase } from './modules/customers/application/use-cases/list-customers.use-case.js';
import { FindCustomerByDocumentUseCase } from './modules/customers/application/use-cases/find-customer-by-document.use-case.js';
import { UpdateCustomerUseCase } from './modules/customers/application/use-cases/update-customer.use-case.js';
import { DeleteCustomerUseCase } from './modules/customers/application/use-cases/delete-customer.use-case.js';
import { CreateCustomerDto } from './modules/customers/application/dto/create-customer.dto.js';
import { UpdateCustomerDto } from './modules/customers/application/dto/update-customer.dto.js';
import { CreateVehicleUseCase } from './modules/vehicles/application/use-cases/create-vehicle.use-case.js';
import { GetVehicleUseCase } from './modules/vehicles/application/use-cases/get-vehicle.use-case.js';
import { ListVehiclesUseCase } from './modules/vehicles/application/use-cases/list-vehicles.use-case.js';
import { UpdateVehicleUseCase } from './modules/vehicles/application/use-cases/update-vehicle.use-case.js';
import { DeleteVehicleUseCase } from './modules/vehicles/application/use-cases/delete-vehicle.use-case.js';
import { CreateVehicleDto } from './modules/vehicles/application/dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from './modules/vehicles/application/dto/update-vehicle.dto.js';
import { customerData, vehicleData } from './identity-repositories.mjs';

export function validateDto(Type, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('Invalid request'), { status: 400 });
  const dto = plainToInstance(Type, body);
  if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length) throw Object.assign(new Error('Invalid request'), { status: 400 });
  return dto;
}

export class IdentityRegistry {
  constructor(customers, vehicles) {
    Object.assign(this, { customers, vehicles });
    this.customerCases = { create: new CreateCustomerUseCase(customers), get: new GetCustomerUseCase(customers), list: new ListCustomersUseCase(customers), find: new FindCustomerByDocumentUseCase(customers), update: new UpdateCustomerUseCase(customers), delete: new DeleteCustomerUseCase(customers) };
    this.vehicleCases = { create: new CreateVehicleUseCase(vehicles), get: new GetVehicleUseCase(vehicles), list: new ListVehiclesUseCase(vehicles), update: new UpdateVehicleUseCase(vehicles), delete: new DeleteVehicleUseCase(vehicles) };
  }
  /** Rules extracted from OpenServiceOrderUseCase; same local transaction as OS/inbox/outbox. */
  async resolveOpening(input, tx) {
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`customer:${input.customer.document}`]);
    let customer = await this.customers.findByDocument(input.customer.document, tx, true);
    if (customer && !customer.isActive) throw new DomainException('Cannot create service order for an inactive customer.');
    if (!customer) {
      customer = new Customer({ id: randomUUID(), ...input.customer, document: new CustomerDocument(input.customer.document, input.customer.documentType) });
      await this.customers.create(customer, tx);
    }
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`vehicle:${input.vehicle.licensePlate}`]);
    let vehicle = await this.vehicles.findByLicensePlate(input.vehicle.licensePlate, tx, true);
    if (vehicle && !vehicle.isActive) throw new DomainException('Cannot create service order for an inactive vehicle.');
    if (vehicle && vehicle.customerId !== customer.id) throw new DomainException('Vehicle does not belong to the specified customer.');
    if (!vehicle) {
      vehicle = new Vehicle({ id: randomUUID(), customerId: customer.id, ...input.vehicle, licensePlate: new LicensePlate(input.vehicle.licensePlate) });
      await this.vehicles.create(vehicle, tx);
    }
    return { customerId: customer.id, vehicleId: vehicle.id, customer: customerData(customer), vehicle: vehicleData(vehicle) };
  }
}

export function identityRoutes(registry) {
  const c = registry.customerCases, v = registry.vehicleCases;
  return [
    { method: 'post', path: '/customers', roles: ['admin'], status: 201, handle: req => c.create.execute(validateDto(CreateCustomerDto, req.body)) },
    { method: 'get', path: '/customers', roles: ['admin'], handle: req => req.query.document ? c.find.execute(req.query.document) : c.list.execute() },
    { method: 'get', path: '/customers/:id', roles: ['admin'], handle: req => c.get.execute(req.params.id) },
    { method: 'patch', path: '/customers/:id', roles: ['admin'], status: 204, handle: req => c.update.execute(req.params.id, validateDto(UpdateCustomerDto, req.body)) },
    { method: 'delete', path: '/customers/:id', roles: ['admin'], status: 204, handle: req => c.delete.execute(req.params.id) },
    { method: 'post', path: '/vehicles', roles: ['admin'], status: 201, handle: req => v.create.execute(validateDto(CreateVehicleDto, req.body)) },
    { method: 'get', path: '/vehicles', roles: ['admin'], handle: () => v.list.execute() },
    { method: 'get', path: '/vehicles/:id', roles: ['admin'], handle: req => v.get.execute(req.params.id) },
    { method: 'patch', path: '/vehicles/:id', roles: ['admin'], status: 204, handle: req => v.update.execute(req.params.id, validateDto(UpdateVehicleDto, req.body)) },
    { method: 'delete', path: '/vehicles/:id', roles: ['admin'], status: 204, handle: req => v.delete.execute(req.params.id) },
  ];
}
