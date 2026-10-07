import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { GetCustomerUseCase } from '../../../../../../src/modules/customers/application/use-cases/get-customer.use-case.js';

describe('GetCustomerUseCase', () => {
  let useCase: GetCustomerUseCase;
  let repo: any;

  beforeEach(() => {
    repo = { findById: jest.fn() };
    useCase = new GetCustomerUseCase(repo);
  });

  it('should return customer when found', async () => {
    repo.findById.mockResolvedValue({
      id: '1',
      name: 'John',
      document: { type: 'CPF', value: '52998224725' },
      phone: '11999',
      email: 'j@t.com',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await useCase.execute('1');
    expect(result.id).toBe('1');
    expect(result.name).toBe('John');
  });

  it('should throw NotFoundException when not found', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('1')).rejects.toThrow(NotFoundException);
  });
});
