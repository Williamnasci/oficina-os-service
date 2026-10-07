import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerRepository } from '../../domain/repositories/customer.repository.js';
import { UpdateCustomerDto } from '../dto/update-customer.dto.js';

@Injectable()
export class UpdateCustomerUseCase {
  constructor(
    @Inject(CustomerRepository)
    private readonly customerRepository: CustomerRepository,
  ) {}

  async execute(id: string, input: UpdateCustomerDto): Promise<void> {
    const customer = await this.customerRepository.findById(id);

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    customer.update({
      name: input.name,
      phone: input.phone,
      email: input.email,
    });

    await this.customerRepository.update(customer);
  }
}
