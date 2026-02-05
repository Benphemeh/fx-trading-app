import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { UserRepository } from '../user/user.repository';
import { TransactionService } from '../transactions/transaction.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VerifiedUserGuard } from '../auth/verified-user.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import { TransactionType } from '../transactions/entities/transaction.entity';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, VerifiedUserGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly transactionService: TransactionService,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users (Admin only)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listUsers(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { users, total } = await this.userRepo.findAll({
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        emailVerified: u.emailVerified,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
    };
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List all transactions across users (Admin only)' })
  @ApiQuery({ name: 'type', required: false, enum: TransactionType })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated transaction list' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listTransactions(
    @Query('type') type?: TransactionType,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.transactionService.getAllHistory({
      type,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }
}
