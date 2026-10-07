import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { VehicleRepository } from '../../domain/repositories/vehicle.repository.js';
import { UpdateVehicleDto } from '../dto/update-vehicle.dto.js';

@Injectable()
export class UpdateVehicleUseCase {
  constructor(
    @Inject(VehicleRepository)
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  async execute(id: string, input: UpdateVehicleDto): Promise<void> {
    const vehicle = await this.vehicleRepository.findById(id);

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found.');
    }

    vehicle.update({
      brand: input.brand,
      model: input.model,
      year: input.year,
    });

    await this.vehicleRepository.update(vehicle);
  }
}
