import { DomainException } from '../../../../../../src/shared/domain/errors/domain.exception.js';
import { Customer } from '../../../../../../src/modules/customers/domain/entities/customer.entity.js';
import { CustomerDocument } from '../../../../../../src/modules/customers/domain/value-objects/customer-document.value-object.js';
import { CustomerDocumentType } from '../../../../../../src/modules/customers/domain/enums/customer-document-type.enum.js';

describe('Customer Entity', () => {
  const validDoc = new CustomerDocument(
    '52998224725',
    CustomerDocumentType.CPF,
  );

  it('should create a customer with valid props', () => {
    const customer = new Customer({
      id: '1',
      name: 'John Doe',
      document: validDoc,
    });
    expect(customer.name).toBe('John Doe');
    expect(customer.isActive).toBe(true);
    expect(customer.phone).toBeNull();
    expect(customer.email).toBeNull();
  });

  it('should throw when name is empty', () => {
    expect(
      () => new Customer({ id: '1', name: '', document: validDoc }),
    ).toThrow(DomainException);
  });

  it('should throw when name is whitespace only', () => {
    expect(
      () => new Customer({ id: '1', name: '   ', document: validDoc }),
    ).toThrow(DomainException);
  });

  it('should update name', () => {
    const customer = new Customer({
      id: '1',
      name: 'John',
      document: validDoc,
    });
    customer.update({ name: 'Jane' });
    expect(customer.name).toBe('Jane');
  });

  it('should throw when updating with empty name', () => {
    const customer = new Customer({
      id: '1',
      name: 'John',
      document: validDoc,
    });
    expect(() => customer.update({ name: '' })).toThrow(DomainException);
  });

  it('should update phone and email', () => {
    const customer = new Customer({
      id: '1',
      name: 'John',
      document: validDoc,
    });
    customer.update({ phone: '11999999999', email: 'john@test.com' });
    expect(customer.phone).toBe('11999999999');
    expect(customer.email).toBe('john@test.com');
  });

  it('should deactivate customer', () => {
    const customer = new Customer({
      id: '1',
      name: 'John',
      document: validDoc,
    });
    customer.deactivate();
    expect(customer.isActive).toBe(false);
  });

  it('should not change fields when update data is undefined', () => {
    const customer = new Customer({
      id: '1',
      name: 'John',
      document: validDoc,
      phone: '123',
    });
    customer.update({});
    expect(customer.name).toBe('John');
    expect(customer.phone).toBe('123');
  });
});
