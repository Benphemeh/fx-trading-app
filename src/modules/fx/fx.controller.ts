import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FxRatesService, FxRatesResponse } from './fx-rates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VerifiedUserGuard } from '../auth/verified-user.guard';

@ApiTags('FX')
@ApiBearerAuth()
@Controller('fx')
@UseGuards(JwtAuthGuard, VerifiedUserGuard)
export class FxController {
  constructor(private readonly fxRatesService: FxRatesService) {}

  @Get('rates')
  @ApiOperation({ summary: 'Retrieve current FX rates for supported currency pairs' })
  @ApiQuery({ name: 'base', required: false, description: 'Base currency (default USD)' })
  @ApiResponse({ status: 200, description: 'Current FX rates' })
  async getRates(@Query('base') base?: string): Promise<FxRatesResponse> {
    return this.fxRatesService.getRates(base || 'USD');
  }
}
