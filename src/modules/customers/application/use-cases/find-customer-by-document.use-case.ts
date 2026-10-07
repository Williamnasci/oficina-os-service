import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerRepository } from '../../domain/repositories/customer.repository.js';
import { CustomerResponseDto } from '../dto/customer-response.dto.js';

@Injectable()
export class FindCustomerByDocumentUseCase {
  constructor(
    @Inject(CustomerRepository)
    private readonly customerRepository: CustomerRepository,
  ) {}

  async execute(document: string): Promise<CustomerResponseDto> {
    const customer = await this.customerRepository.findByDocument(document);

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    return {
      id: customer.id,
      name: customer.name,
      documentType: customer.document.type,
      document: customer.document.value,
      phone: customer.phone,
      email: customer.email,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }
}
