import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Customer } from '../../domain/entities/customer.entity.js';
import { CustomerRepository } from '../../domain/repositories/customer.repository.js';
import { CustomerDocument } from '../../domain/value-objects/customer-document.value-object.js';
import { CreateCustomerDto } from '../dto/create-customer.dto.js';

@Injectable()
export class CreateCustomerUseCase {
  constructor(
    @Inject(CustomerRepository)
    private readonly customerRepository: CustomerRepository,
  ) {}

  async execute(input: CreateCustomerDto): Promise<{ id: string }> {
    const customer = new Customer({
      id: randomUUID(),
      name: input.name,
      document: new CustomerDocument(input.document, input.documentType),
      phone: input.phone,
      email: input.email,
    });

    await this.customerRepository.create(customer);

    return { id: customer.id };
  }
}
