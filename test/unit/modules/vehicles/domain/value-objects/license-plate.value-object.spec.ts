import { LicensePlate } from '../../../../../../src/modules/vehicles/domain/value-objects/license-plate.value-object.js';
import { DomainException } from '../../../../../../src/shared/domain/errors/domain.exception.js';

describe('LicensePlate Value Object', () => {
  it('should create old format', () => {
    const plate = new LicensePlate('ABC1234');
    expect(plate.value).toBe('ABC1234');
    expect(plate.isOldFormat).toBe(true);
    expect(plate.isMercosulFormat).toBe(false);
  });

  it('should create mercosul format', () => {
    const plate = new LicensePlate('ABC1D23');
    expect(plate.value).toBe('ABC1D23');
    expect(plate.isOldFormat).toBe(false);
    expect(plate.isMercosulFormat).toBe(true);
  });

  it('should throw on invalid plate', () => {
    expect(() => new LicensePlate('ABC123')).toThrow(DomainException);
  });
});
