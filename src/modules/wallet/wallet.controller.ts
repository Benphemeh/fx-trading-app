import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { FundWalletDto } from './dto/fund.dto';
import { ConvertWalletDto } from './dto/convert.dto';
import { TradeWalletDto } from './dto/trade.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VerifiedUserGuard } from '../auth/verified-user.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../user/entities/user.entity';

@ApiTags('Wallet')
@ApiBearerAuth()
@Controller('wallet')
@UseGuards(JwtAuthGuard, VerifiedUserGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Get user wallet balances by currency' })
  @ApiResponse({ status: 200, description: 'Wallet balances' })
  async getWallet(@CurrentUser() user: User) {
    return this.walletService.getBalances(user.id);
  }

  @Post('fund')
  @ApiOperation({ summary: 'Fund wallet in NGN or other currencies' })
  @ApiResponse({ status: 201, description: 'Wallet funded' })
  async fund(@CurrentUser() user: User, @Body() dto: FundWalletDto) {
    return this.walletService.fund(user, dto.currency, dto.amount, dto.idempotencyKey);
  }

  @Post('convert')
  @ApiOperation({ summary: 'Convert between currencies using real-time FX rates' })
  @ApiResponse({ status: 201, description: 'Conversion completed' })
  async convert(@CurrentUser() user: User, @Body() dto: ConvertWalletDto) {
    return this.walletService.convert(
      user,
      dto.sourceCurrency,
      dto.destinationCurrency,
      dto.amount,
      dto.idempotencyKey,
    );
  }

  @Post('trade')
  @ApiOperation({ summary: 'Trade Naira with other currencies and vice versa' })
  @ApiResponse({ status: 201, description: 'Trade completed' })
  async trade(@CurrentUser() user: User, @Body() dto: TradeWalletDto) {
    return this.walletService.trade(
      user,
      dto.fromCurrency,
      dto.toCurrency,
      dto.amount,
      dto.idempotencyKey,
    );
  }
}
