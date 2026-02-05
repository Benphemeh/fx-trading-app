import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min, IsIn } from 'class-validator';

const CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP'];

export class ConvertWalletDto {
  @ApiProperty({ example: 'NGN', description: 'Source currency' })
  @IsString()
  @IsIn(CURRENCIES)
  sourceCurrency: string;

  @ApiProperty({ example: 'USD', description: 'Destination currency' })
  @IsString()
  @IsIn(CURRENCIES)
  destinationCurrency: string;

  @ApiProperty({ example: 1000, minimum: 0.01 })
  @IsNumber()
  @Min(0.01, { message: 'Amount must be positive' })
  amount: number;

  @ApiPropertyOptional({ description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
