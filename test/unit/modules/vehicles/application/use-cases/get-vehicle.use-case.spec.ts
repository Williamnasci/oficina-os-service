import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { GetVehicleUseCase } from '../../../../../../src/modules/vehicles/application/use-cases/get-vehicle.use-case.js';

describe('GetVehicleUseCase', () => {
  let useCase: GetVehicleUseCase;
  let repo: any;

  beforeEach(() => {
    repo = { findById: jest.fn() };
    useCase = new GetVehicleUseCase(repo);
  });

  it('should return vehicle when found', async () => {
    repo.findById.mockResolvedValue({
      id: '1',
      customerId: 'c-1',
      licensePlate: { value: 'ABC1234' },
      brand: 'Toyota',
      model: 'Corolla',
      year: 2022,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await useCase.execute('1');
    expect(result.id).toBe('1');
    expect(result.licensePlate).toBe('ABC1234');
  });

  it('should throw NotFoundException when not found', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('1')).rejects.toThrow(NotFoundException);
  });
});
