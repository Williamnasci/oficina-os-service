import { CustomerDocument } from '../../../../../../src/modules/customers/domain/value-objects/customer-document.value-object.js';
import { CustomerDocumentType } from '../../../../../../src/modules/customers/domain/enums/customer-document-type.enum.js';
import { DomainException } from '../../../../../../src/shared/domain/errors/domain.exception.js';

describe('CustomerDocument Value Object', () => {
  it('should validate valid CPF', () => {
    const doc = new CustomerDocument('52998224725', CustomerDocumentType.CPF);
    expect(doc.value).toBe('52998224725');
    expect(doc.type).toBe(CustomerDocumentType.CPF);
  });

  it('should throw on invalid CPF', () => {
    expect(
      () => new CustomerDocument('11111111111', CustomerDocumentType.CPF),
    ).toThrow(DomainException);
  });

  it('should throw on CPF with false math', () => {
    expect(
      () => new CustomerDocument('12345678901', CustomerDocumentType.CPF),
    ).toThrow(DomainException);
  });

  it('should validate valid CNPJ', () => {
    const doc = new CustomerDocument(
      '00000000000191',
      CustomerDocumentType.CNPJ,
    );
    expect(doc.value).toBe('00000000000191');
    expect(doc.type).toBe(CustomerDocumentType.CNPJ);
  });

  it('should throw on invalid CNPJ formatting', () => {
    expect(
      () => new CustomerDocument('11111111111111', CustomerDocumentType.CNPJ),
    ).toThrow(DomainException);
  });

  it('should throw on CNPJ with false math', () => {
    expect(
      () => new CustomerDocument('12345678901234', CustomerDocumentType.CNPJ),
    ).toThrow(DomainException);
  });
});
