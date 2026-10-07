import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { FindCustomerByDocumentUseCase } from '../../../../../../src/modules/customers/application/use-cases/find-customer-by-document.use-case.js';

describe('FindCustomerByDocumentUseCase', () => {
  let useCase: FindCustomerByDocumentUseCase;
  let repo: any;

  beforeEach(() => {
    repo = { findByDocument: jest.fn() };
    useCase = new FindCustomerByDocumentUseCase(repo);
  });

  it('should return customer when found by document', async () => {
    repo.findByDocument.mockResolvedValue({
      id: '1',
      name: 'John',
      document: { type: 'CPF', value: '52998224725' },
      phone: null,
      email: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await useCase.execute('52998224725');
    expect(result.document).toBe('52998224725');
  });

  it('should throw NotFoundException when not found', async () => {
    repo.findByDocument.mockResolvedValue(null);
    await expect(useCase.execute('00000000000')).rejects.toThrow(
      NotFoundException,
    );
  });
});
