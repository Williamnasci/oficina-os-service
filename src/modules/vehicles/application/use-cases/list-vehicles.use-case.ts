import { Inject, Injectable } from '@nestjs/common';
import { VehicleRepository } from '../../domain/repositories/vehicle.repository.js';
import { VehicleResponseDto } from '../dto/vehicle-response.dto.js';

@Injectable()
export class ListVehiclesUseCase {
  constructor(
    @Inject(VehicleRepository)
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  async execute(): Promise<VehicleResponseDto[]> {
    const vehicles = await this.vehicleRepository.findAll();

    return vehicles.map((vehicle) => ({
      id: vehicle.id,
      customerId: vehicle.customerId,
      licensePlate: vehicle.licensePlate.value,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      isActive: vehicle.isActive,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    }));
  }
}
