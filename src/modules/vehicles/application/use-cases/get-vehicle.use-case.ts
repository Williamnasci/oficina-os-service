import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { VehicleRepository } from '../../domain/repositories/vehicle.repository.js';
import { VehicleResponseDto } from '../dto/vehicle-response.dto.js';

@Injectable()
export class GetVehicleUseCase {
  constructor(
    @Inject(VehicleRepository)
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  async execute(id: string): Promise<VehicleResponseDto> {
    const vehicle = await this.vehicleRepository.findById(id);

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found.');
    }

    return {
      id: vehicle.id,
      customerId: vehicle.customerId,
      licensePlate: vehicle.licensePlate.value,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      isActive: vehicle.isActive,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    };
  }
}
