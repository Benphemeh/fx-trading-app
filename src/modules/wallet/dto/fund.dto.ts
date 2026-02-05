import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min, IsIn } from 'class-validator';

export class FundWalletDto {
  @ApiProperty({ example: 'NGN', description: 'Currency to fund' })
  @IsString()
  @IsIn(['NGN', 'USD', 'EUR', 'GBP'])
  currency: string;

  @ApiProperty({ example: 1000, minimum: 0.01 })
  @IsNumber()
  @Min(0.01, { message: 'Amount must be positive' })
  amount: number;

  @ApiPropertyOptional({ description: 'Idempotency key for duplicate request handling' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
