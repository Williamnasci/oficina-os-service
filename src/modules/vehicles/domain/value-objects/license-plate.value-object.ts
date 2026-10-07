import { DomainException } from '../../../../shared/domain/errors/domain.exception.js';

export class LicensePlate {
  private readonly _value: string;

  constructor(value: string) {
    const normalizedValue = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    const oldFormatRegex = /^[A-Z]{3}[0-9]{4}$/;
    const mercosulFormatRegex = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

    if (
      !oldFormatRegex.test(normalizedValue) &&
      !mercosulFormatRegex.test(normalizedValue)
    ) {
      throw new DomainException('Invalid Brazilian license plate.');
    }

    this._value = normalizedValue;
  }

  get value(): string {
    return this._value;
  }

  get isOldFormat(): boolean {
    return /^[A-Z]{3}[0-9]{4}$/.test(this._value);
  }

  get isMercosulFormat(): boolean {
    return /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(this._value);
  }
}
