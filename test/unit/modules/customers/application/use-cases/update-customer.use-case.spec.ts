import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { UpdateCustomerUseCase } from '../../../../../../src/modules/customers/application/use-cases/update-customer.use-case.js';

describe('UpdateCustomerUseCase', () => {
  let useCase: UpdateCustomerUseCase;
  let repo: any;

  beforeEach(() => {
    repo = { findById: jest.fn(), update: jest.fn() };
    useCase = new UpdateCustomerUseCase(repo);
  });

  it('should update customer', async () => {
    const customer = { update: jest.fn() };
    repo.findById.mockResolvedValue(customer);
    repo.update.mockResolvedValue(undefined);

    await useCase.execute('1', { name: 'New Name' });
    expect(customer.update).toHaveBeenCalledWith({
      name: 'New Name',
      phone: undefined,
      email: undefined,
    });
    expect(repo.update).toHaveBeenCalled();
  });

  it('should throw NotFoundException when not found', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('1', { name: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });
});
