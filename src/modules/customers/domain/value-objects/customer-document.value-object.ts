import { DomainException } from '../../../../shared/domain/errors/domain.exception.js';
import { CustomerDocumentType } from '../enums/customer-document-type.enum.js';

export class CustomerDocument {
  private _value: string;
  private _type: CustomerDocumentType;

  constructor(value: string, type: CustomerDocumentType) {
    const normalizedValue = value.replace(/\D/g, '');

    if (
      type === CustomerDocumentType.CPF &&
      !this.isValidCPF(normalizedValue)
    ) {
      throw new DomainException('Invalid CPF.');
    }

    if (
      type === CustomerDocumentType.CNPJ &&
      !this.isValidCNPJ(normalizedValue)
    ) {
      throw new DomainException('Invalid CNPJ.');
    }

    this._value = normalizedValue;
    this._type = type;
  }

  static restore(value: string, type: CustomerDocumentType): CustomerDocument {
    const instance = Object.create(
      CustomerDocument.prototype,
    ) as CustomerDocument;
    instance._value = value;
    instance._type = type;
    return instance;
  }

  private isValidCPF(cpf: string): boolean {
    if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

    const calcDigit = (factor: number, max: number) => {
      let total = 0;
      for (let i = 0; i < max; i++) {
        total += parseInt(cpf[i]) * factor--;
      }
      const remainder = (total * 10) % 11;
      return remainder === 10 ? 0 : remainder;
    };

    const digit1 = calcDigit(10, 9);
    const digit2 = calcDigit(11, 10);

    return digit1 === parseInt(cpf[9]) && digit2 === parseInt(cpf[10]);
  }

  private isValidCNPJ(cnpj: string): boolean {
    if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;

    const calcDigit = (length: number) => {
      let total = 0;
      let factor = length - 7;
      for (let i = length; i >= 1; i--) {
        total += parseInt(cnpj[length - i]) * factor--;
        if (factor < 2) factor = 9;
      }
      const remainder = total % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };

    const digit1 = calcDigit(12);
    const digit2 = calcDigit(13);

    return digit1 === parseInt(cnpj[12]) && digit2 === parseInt(cnpj[13]);
  }

  get value(): string {
    return this._value;
  }

  get type(): CustomerDocumentType {
    return this._type;
  }
}
