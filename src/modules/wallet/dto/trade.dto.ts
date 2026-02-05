import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min, IsIn } from 'class-validator';

const CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP'];

export class TradeWalletDto {
  @ApiProperty({ example: 'NGN', description: 'Currency to sell' })
  @IsString()
  @IsIn(CURRENCIES)
  fromCurrency: string;

  @ApiProperty({ example: 'USD', description: 'Currency to buy' })
  @IsString()
  @IsIn(CURRENCIES)
  toCurrency: string;

  @ApiProperty({ example: 1000, minimum: 0.01 })
  @IsNumber()
  @Min(0.01, { message: 'Amount must be positive' })
  amount: number;

  @ApiPropertyOptional({ description: 'Idempotency key' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
