import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { DeleteCustomerUseCase } from '../../../../../../src/modules/customers/application/use-cases/delete-customer.use-case.js';

describe('DeleteCustomerUseCase', () => {
  let useCase: DeleteCustomerUseCase;
  let repo: any;

  beforeEach(() => {
    repo = { findById: jest.fn(), update: jest.fn() };
    useCase = new DeleteCustomerUseCase(repo);
  });

  it('should deactivate customer', async () => {
    const customer = { deactivate: jest.fn() };
    repo.findById.mockResolvedValue(customer);
    repo.update.mockResolvedValue(undefined);

    await useCase.execute('1');
    expect(customer.deactivate).toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith(customer);
  });

  it('should throw NotFoundException when not found', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('1')).rejects.toThrow(NotFoundException);
  });
});
