import { jest } from '@jest/globals';
import { CreateVehicleUseCase } from '../../../../../../src/modules/vehicles/application/use-cases/create-vehicle.use-case.js';
import { VehicleRepository } from '../../../../../../src/modules/vehicles/domain/repositories/vehicle.repository.js';

describe('CreateVehicleUseCase', () => {
  let useCase: CreateVehicleUseCase;
  let repository: jest.Mocked<VehicleRepository>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByLicensePlate: jest.fn(),
    } as any;
    useCase = new CreateVehicleUseCase(repository);
  });

  it('should create a vehicle', async () => {
    const result = await useCase.execute({
      customerId: 'customer-1',
      licensePlate: 'ABC1234',
      brand: 'VW',
      model: 'Gol',
      year: 2020,
    });
    expect(repository.create).toHaveBeenCalled();
    expect(result.id).toBeDefined();
  });
});
