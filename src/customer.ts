import { CustomerDocument } from './modules/customers/domain/value-objects/customer-document.value-object.js';
import { CustomerDocumentType } from './modules/customers/domain/enums/customer-document-type.enum.js';
import { LicensePlate } from './modules/vehicles/domain/value-objects/license-plate.value-object.js';

export function normalizeDocument(value: string, type: 'CPF' | 'CNPJ'): string {
  return new CustomerDocument(value, type as CustomerDocumentType).value;
}

export function normalizePlate(value: string): string {
  return new LicensePlate(value).value;
}
