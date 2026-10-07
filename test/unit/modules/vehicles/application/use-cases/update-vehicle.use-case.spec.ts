import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { UpdateVehicleUseCase } from '../../../../../../src/modules/vehicles/application/use-cases/update-vehicle.use-case.js';

describe('UpdateVehicleUseCase', () => {
  let useCase: UpdateVehicleUseCase;
  let repo: any;

  beforeEach(() => {
    repo = { findById: jest.fn(), update: jest.fn() };
    useCase = new UpdateVehicleUseCase(repo);
  });

  it('should update vehicle', async () => {
    const vehicle = { update: jest.fn() };
    repo.findById.mockResolvedValue(vehicle);
    repo.update.mockResolvedValue(undefined);

    await useCase.execute('1', { brand: 'Honda' });
    expect(vehicle.update).toHaveBeenCalledWith({
      brand: 'Honda',
      model: undefined,
      year: undefined,
    });
    expect(repo.update).toHaveBeenCalled();
  });

  it('should throw NotFoundException when not found', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('1', { brand: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });
});
