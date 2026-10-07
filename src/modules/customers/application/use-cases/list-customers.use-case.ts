import { Inject, Injectable } from '@nestjs/common';
import { CustomerRepository } from '../../domain/repositories/customer.repository.js';
import { CustomerResponseDto } from '../dto/customer-response.dto.js';

@Injectable()
export class ListCustomersUseCase {
  constructor(
    @Inject(CustomerRepository)
    private readonly customerRepository: CustomerRepository,
  ) {}

  async execute(): Promise<CustomerResponseDto[]> {
    const customers = await this.customerRepository.findAll();

    return customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      documentType: customer.document.type,
      document: customer.document.value,
      phone: customer.phone,
      email: customer.email,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    }));
  }
}
