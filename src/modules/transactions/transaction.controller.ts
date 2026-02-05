import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VerifiedUserGuard } from '../auth/verified-user.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../user/entities/user.entity';
import { TransactionType } from './entities/transaction.entity';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(JwtAuthGuard, VerifiedUserGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  @ApiOperation({ summary: 'View transaction history' })
  @ApiQuery({ name: 'type', required: false, enum: TransactionType })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Transaction history' })
  async getTransactions(
    @CurrentUser() user: User,
    @Query('type') type?: TransactionType,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.transactionService.getHistory(user.id, {
      type,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }
}
