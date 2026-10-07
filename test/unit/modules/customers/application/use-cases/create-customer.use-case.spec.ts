import { jest } from '@jest/globals';
import { CreateCustomerUseCase } from '../../../../../../src/modules/customers/application/use-cases/create-customer.use-case.js';
import { CustomerRepository } from '../../../../../../src/modules/customers/domain/repositories/customer.repository.js';
import { CustomerDocumentType } from '../../../../../../src/modules/customers/domain/enums/customer-document-type.enum.js';

describe('CreateCustomerUseCase', () => {
  let useCase: CreateCustomerUseCase;
  let repository: jest.Mocked<CustomerRepository>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByDocument: jest.fn(),
    } as any;
    useCase = new CreateCustomerUseCase(repository);
  });

  it('should create a customer', async () => {
    const input = {
      name: 'João',
      document: '52998224725',
      documentType: CustomerDocumentType.CPF,
      phone: '11999999999',
      email: 'joao@mail.com',
    };
    const result = await useCase.execute(input);
    expect(repository.create).toHaveBeenCalled();
    expect(result.id).toBeDefined();
  });
});
