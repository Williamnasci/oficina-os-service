import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { CustomerDocumentType } from '../../domain/enums/customer-document-type.enum.js';

export class CreateCustomerDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({
    enum: CustomerDocumentType,
    example: CustomerDocumentType.CPF,
  })
  @IsEnum(CustomerDocumentType)
  documentType: CustomerDocumentType;

  @ApiProperty({ example: '12345678901' })
  @IsString()
  document: string;

  @ApiPropertyOptional({ example: '11999999999' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
