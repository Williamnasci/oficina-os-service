import { DomainException } from '../../../../../../src/shared/domain/errors/domain.exception.js';
import { Vehicle } from '../../../../../../src/modules/vehicles/domain/entities/vehicle.entity.js';
import { LicensePlate } from '../../../../../../src/modules/vehicles/domain/value-objects/license-plate.value-object.js';

describe('Vehicle Entity', () => {
  const plate = new LicensePlate('ABC1234');

  it('should create a vehicle with valid props', () => {
    const vehicle = new Vehicle({
      id: '1',
      customerId: 'c-1',
      licensePlate: plate,
      brand: 'Toyota',
      model: 'Corolla',
      year: 2022,
    });
    expect(vehicle.brand).toBe('Toyota');
    expect(vehicle.isActive).toBe(true);
  });

  it('should throw when brand is empty', () => {
    expect(
      () =>
        new Vehicle({
          id: '1',
          customerId: 'c-1',
          licensePlate: plate,
          brand: '',
          model: 'X',
          year: 2022,
        }),
    ).toThrow(DomainException);
  });

  it('should throw when model is empty', () => {
    expect(
      () =>
        new Vehicle({
          id: '1',
          customerId: 'c-1',
          licensePlate: plate,
          brand: 'X',
          model: '',
          year: 2022,
        }),
    ).toThrow(DomainException);
  });

  it('should update brand', () => {
    const vehicle = new Vehicle({
      id: '1',
      customerId: 'c-1',
      licensePlate: plate,
      brand: 'Toyota',
      model: 'Corolla',
      year: 2022,
    });
    vehicle.update({ brand: 'Honda' });
    expect(vehicle.brand).toBe('Honda');
  });

  it('should throw when updating with empty brand', () => {
    const vehicle = new Vehicle({
      id: '1',
      customerId: 'c-1',
      licensePlate: plate,
      brand: 'Toyota',
      model: 'Corolla',
      year: 2022,
    });
    expect(() => vehicle.update({ brand: '' })).toThrow(DomainException);
  });

  it('should throw when updating with empty model', () => {
    const vehicle = new Vehicle({
      id: '1',
      customerId: 'c-1',
      licensePlate: plate,
      brand: 'Toyota',
      model: 'Corolla',
      year: 2022,
    });
    expect(() => vehicle.update({ model: '  ' })).toThrow(DomainException);
  });

  it('should update year', () => {
    const vehicle = new Vehicle({
      id: '1',
      customerId: 'c-1',
      licensePlate: plate,
      brand: 'Toyota',
      model: 'Corolla',
      year: 2022,
    });
    vehicle.update({ year: 2023 });
    expect(vehicle.year).toBe(2023);
  });

  it('should deactivate vehicle', () => {
    const vehicle = new Vehicle({
      id: '1',
      customerId: 'c-1',
      licensePlate: plate,
      brand: 'Toyota',
      model: 'Corolla',
      year: 2022,
    });
    vehicle.deactivate();
    expect(vehicle.isActive).toBe(false);
  });

  it('should not change fields when update data is empty', () => {
    const vehicle = new Vehicle({
      id: '1',
      customerId: 'c-1',
      licensePlate: plate,
      brand: 'Toyota',
      model: 'Corolla',
      year: 2022,
    });
    vehicle.update({});
    expect(vehicle.brand).toBe('Toyota');
  });
});
