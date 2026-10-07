import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { VehicleRepository } from '../../domain/repositories/vehicle.repository.js';

@Injectable()
export class DeleteVehicleUseCase {
  constructor(
    @Inject(VehicleRepository)
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const vehicle = await this.vehicleRepository.findById(id);

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found.');
    }

    vehicle.deactivate();

    await this.vehicleRepository.update(vehicle);
  }
}
