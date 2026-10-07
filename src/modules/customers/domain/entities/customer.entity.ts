import { DomainException } from '../../../../shared/domain/errors/domain.exception.js';
import { CustomerDocument } from '../value-objects/customer-document.value-object.js';

export type CustomerProps = {
  id: string;
  name: string;
  document: CustomerDocument;
  phone?: string | null;
  email?: string | null;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export class Customer {
  public readonly id: string;
  public name: string;
  public document: CustomerDocument;
  public phone: string | null;
  public email: string | null;
  public isActive: boolean;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: CustomerProps) {
    if (!props.name?.trim()) {
      throw new DomainException('Customer name is required.');
    }

    this.id = props.id;
    this.name = props.name.trim();
    this.document = props.document;
    this.phone = props.phone ?? null;
    this.email = props.email ?? null;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  public update(data: {
    name?: string;
    phone?: string | null;
    email?: string | null;
  }): void {
    if (data.name !== undefined) {
      if (!data.name.trim()) {
        throw new DomainException('Customer name is required.');
      }
      this.name = data.name.trim();
    }

    if (data.phone !== undefined) {
      this.phone = data.phone;
    }

    if (data.email !== undefined) {
      this.email = data.email;
    }

    this.updatedAt = new Date();
  }

  public deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }
}
