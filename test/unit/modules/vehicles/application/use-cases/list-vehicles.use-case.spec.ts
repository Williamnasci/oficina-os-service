import { jest } from '@jest/globals';
import { ListVehiclesUseCase } from '../../../../../../src/modules/vehicles/application/use-cases/list-vehicles.use-case.js';

describe('ListVehiclesUseCase', () => {
  let useCase: ListVehiclesUseCase;
  let repo: any;

  beforeEach(() => {
    repo = { findAll: jest.fn() };
    useCase = new ListVehiclesUseCase(repo);
  });

  it('should return list of vehicles', async () => {
    repo.findAll.mockResolvedValue([
      {
        id: '1',
        customerId: 'c-1',
        licensePlate: { value: 'ABC1234' },
        brand: 'Toyota',
        model: 'Corolla',
        year: 2022,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await useCase.execute();
    expect(result).toHaveLength(1);
  });

  it('should return empty array when no vehicles', async () => {
    repo.findAll.mockResolvedValue([]);
    const result = await useCase.execute();
    expect(result).toHaveLength(0);
  });
});
