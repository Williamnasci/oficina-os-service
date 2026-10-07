import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, Min } from 'class-validator';

export class CreateVehicleDto {
  @ApiProperty({
    description: 'Customer id (UUID)',
    example: '18201d07-08aa-4e2f-ae0e-35a06e0e5e49',
  })
  @IsUUID()
  customerId: string;

  @ApiProperty({
    description: 'Brazilian license plate (old or Mercosul format)',
    example: 'ABC1234',
  })
  @IsString()
  licensePlate: string;

  @ApiProperty({ example: 'Toyota' })
  @IsString()
  brand: string;

  @ApiProperty({ example: 'Corolla' })
  @IsString()
  model: string;

  @ApiProperty({ example: 2022 })
  @IsInt()
  @Min(1900)
  year: number;
}
