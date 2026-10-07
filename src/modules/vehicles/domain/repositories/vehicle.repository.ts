import { Vehicle } from '../entities/vehicle.entity.js';
import { TransactionContext } from '../../../../shared/domain/unit-of-work.js';

export abstract class VehicleRepository {
  abstract create(vehicle: Vehicle, tx?: TransactionContext): Promise<void>;
  abstract findById(id: string): Promise<Vehicle | null>;
  abstract findByLicensePlate(licensePlate: string): Promise<Vehicle | null>;
  abstract findAll(): Promise<Vehicle[]>;
  abstract findByCustomerId(customerId: string): Promise<Vehicle[]>;
  abstract update(vehicle: Vehicle): Promise<void>;
}
