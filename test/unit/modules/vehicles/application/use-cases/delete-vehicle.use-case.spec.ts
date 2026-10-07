import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { DeleteVehicleUseCase } from '../../../../../../src/modules/vehicles/application/use-cases/delete-vehicle.use-case.js';

describe('DeleteVehicleUseCase', () => {
  let useCase: DeleteVehicleUseCase;
  let repo: any;

  beforeEach(() => {
    repo = { findById: jest.fn(), update: jest.fn() };
    useCase = new DeleteVehicleUseCase(repo);
  });

  it('should deactivate vehicle', async () => {
    const vehicle = { deactivate: jest.fn() };
    repo.findById.mockResolvedValue(vehicle);
    repo.update.mockResolvedValue(undefined);

    await useCase.execute('1');
    expect(vehicle.deactivate).toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith(vehicle);
  });

  it('should throw NotFoundException when not found', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('1')).rejects.toThrow(NotFoundException);
  });
});
