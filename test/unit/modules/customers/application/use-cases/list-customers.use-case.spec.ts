import { jest } from '@jest/globals';
import { ListCustomersUseCase } from '../../../../../../src/modules/customers/application/use-cases/list-customers.use-case.js';

describe('ListCustomersUseCase', () => {
  let useCase: ListCustomersUseCase;
  let repo: any;

  beforeEach(() => {
    repo = { findAll: jest.fn() };
    useCase = new ListCustomersUseCase(repo);
  });

  it('should return list of customers', async () => {
    repo.findAll.mockResolvedValue([
      {
        id: '1',
        name: 'John',
        document: { type: 'CPF', value: '52998224725' },
        phone: null,
        email: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await useCase.execute();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('John');
  });

  it('should return empty array when no customers', async () => {
    repo.findAll.mockResolvedValue([]);
    const result = await useCase.execute();
    expect(result).toHaveLength(0);
  });
});
