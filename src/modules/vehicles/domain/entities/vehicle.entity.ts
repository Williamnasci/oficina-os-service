import { DomainException } from '../../../../shared/domain/errors/domain.exception.js';
import { LicensePlate } from '../value-objects/license-plate.value-object.js';

export type VehicleProps = {
  id: string;
  customerId: string;
  licensePlate: LicensePlate;
  brand: string;
  model: string;
  year: number;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export class Vehicle {
  public readonly id: string;
  public readonly customerId: string;
  public licensePlate: LicensePlate;
  public brand: string;
  public model: string;
  public year: number;
  public isActive: boolean;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: VehicleProps) {
    if (!props.brand?.trim()) {
      throw new DomainException('Vehicle brand is required.');
    }

    if (!props.model?.trim()) {
      throw new DomainException('Vehicle model is required.');
    }

    this.id = props.id;
    this.customerId = props.customerId;
    this.licensePlate = props.licensePlate;
    this.brand = props.brand.trim();
    this.model = props.model.trim();
    this.year = props.year;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  public update(data: { brand?: string; model?: string; year?: number }): void {
    if (data.brand !== undefined) {
      if (!data.brand.trim()) {
        throw new DomainException('Vehicle brand is required.');
      }
      this.brand = data.brand.trim();
    }

    if (data.model !== undefined) {
      if (!data.model.trim()) {
        throw new DomainException('Vehicle model is required.');
      }
      this.model = data.model.trim();
    }

    if (data.year !== undefined) {
      this.year = data.year;
    }

    this.updatedAt = new Date();
  }

  public deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }
}
