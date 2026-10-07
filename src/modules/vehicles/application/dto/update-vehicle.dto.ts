import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateVehicleDto {
  @ApiPropertyOptional({ example: 'Honda' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ example: 'Civic' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: 2023, minimum: 1900 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  year?: number;
}
