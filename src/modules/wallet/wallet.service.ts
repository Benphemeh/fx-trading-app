import {
  Injectable,
  BadRequestException,
  ConflictException,
  Inject,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { WalletRepository } from './wallet.repository';
import { TransactionRepository } from '../transactions/transaction.repository';
import { FxRatesService } from '../fx/fx-rates.service';
import { APP_REPOSITORIES } from '../../constants/repositories';
import { toMinorUnits, fromMinorUnits } from '../../constants/currencies';
import { TransactionType, TransactionStatus } from '../transactions/entities/transaction.entity';
import type { User } from '../user/entities/user.entity';

const SUPPORTED_CURRENCIES_KEY = 'SUPPORTED_CURRENCIES';

function parseSupportedCurrencies(value: string): string[] {
  return value
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @Inject(APP_REPOSITORIES.WALLET)
    private readonly walletRepo: WalletRepository,
    @Inject(APP_REPOSITORIES.TRANSACTION)
    private readonly transactionRepo: TransactionRepository,
    private readonly fxRatesService: FxRatesService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  private getSupportedCurrencies(): string[] {
    const raw = this.config.get<string>('SUPPORTED_CURRENCIES', 'NGN,USD,EUR,GBP');
    return parseSupportedCurrencies(raw);
  }

  private validateCurrency(currency: string): void {
    const supported = this.getSupportedCurrencies();
    if (!supported.includes(currency.toUpperCase())) {
      throw new BadRequestException(
        `Unsupported currency: ${currency}. Supported: ${supported.join(', ')}`,
      );
    }
  }

  async getBalances(userId: string): Promise<{ currency: string; balance: number; balanceMinor: string }[]> {
    const rows = await this.walletRepo.findByUserId(userId);
    const supported = this.getSupportedCurrencies();
    const result = rows.map((r) => ({
      currency: r.currency,
      balance: fromMinorUnits(Number(r.balanceMinor), r.currency),
      balanceMinor: String(r.balanceMinor),
    }));
    supported.forEach((c) => {
      if (!result.some((r) => r.currency === c)) {
        result.push({ currency: c, balance: 0, balanceMinor: '0' });
      }
    });
    result.sort((a, b) => a.currency.localeCompare(b.currency));
    return result;
  }

  async fund(
    user: User,
    currency: string,
    amount: number,
    idempotencyKey?: string,
  ): Promise<{ currency: string; newBalance: number }> {
    this.validateCurrency(currency);
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    const amountMinor = toMinorUnits(amount, currency);
    if (idempotencyKey) {
      const existing = await this.transactionRepo.findByIdempotencyKey(idempotencyKey);
      if (existing && existing.type === TransactionType.FUND) {
        const wb = await this.walletRepo.findByUserAndCurrency(user.id, currency);
        const balance = wb ? fromMinorUnits(Number(wb.balanceMinor), currency) : 0;
        return { currency, newBalance: balance };
      }
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await this.walletRepo.getOrCreate(user.id, currency, queryRunner);
      await this.walletRepo.addBalance(user.id, currency, amountMinor, queryRunner);
      await this.transactionRepo.create(
        {
          userId: user.id,
          type: TransactionType.FUND,
          status: TransactionStatus.COMPLETED,
          amountMinor: String(amountMinor),
          currency,
          idempotencyKey: idempotencyKey || null,
        },
        queryRunner,
      );
      await queryRunner.commitTransaction();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
    const wb = await this.walletRepo.findByUserAndCurrency(user.id, currency);
    const newBalance = wb ? fromMinorUnits(Number(wb.balanceMinor), currency) : amount;
    return { currency, newBalance };
  }

  async convert(
    user: User,
    sourceCurrency: string,
    destinationCurrency: string,
    amount: number,
    idempotencyKey?: string,
  ): Promise<{
    sourceCurrency: string;
    destinationCurrency: string;
    amountSource: number;
    amountDestination: number;
    rateUsed: number;
  }> {
    this.validateCurrency(sourceCurrency);
    this.validateCurrency(destinationCurrency);
    if (sourceCurrency === destinationCurrency) {
      throw new BadRequestException('Source and destination currencies must differ');
    }
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    const amountMinor = toMinorUnits(amount, sourceCurrency);
    if (idempotencyKey) {
      const existing = await this.transactionRepo.findByIdempotencyKey(idempotencyKey);
      if (existing && existing.type === TransactionType.CONVERT) {
        return {
          sourceCurrency,
          destinationCurrency,
          amountSource: amount,
          amountDestination: fromMinorUnits(Number(existing.amountDestinationMinor!), destinationCurrency),
          rateUsed: Number(existing.rateUsed!),
        };
      }
    }
    const { amountDestinationMinor, rate } = await this.fxRatesService.convert(
      amountMinor,
      sourceCurrency,
      destinationCurrency,
    );
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const debited = await this.walletRepo.subtractBalance(
        user.id,
        sourceCurrency,
        amountMinor,
        queryRunner,
      );
      if (!debited) {
        throw new BadRequestException('Insufficient balance');
      }
      await this.walletRepo.getOrCreate(user.id, destinationCurrency, queryRunner);
      await this.walletRepo.addBalance(user.id, destinationCurrency, amountDestinationMinor, queryRunner);
      await this.transactionRepo.create(
        {
          userId: user.id,
          type: TransactionType.CONVERT,
          status: TransactionStatus.COMPLETED,
          amountMinor: String(amountMinor),
          currency: sourceCurrency,
          amountDestinationMinor: String(amountDestinationMinor),
          currencyDestination: destinationCurrency,
          rateUsed: String(rate),
          idempotencyKey: idempotencyKey || null,
        },
        queryRunner,
      );
      await queryRunner.commitTransaction();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      if (e instanceof BadRequestException) throw e;
      this.logger.error(e);
      throw new BadRequestException('Conversion failed');
    } finally {
      await queryRunner.release();
    }
    return {
      sourceCurrency,
      destinationCurrency,
      amountSource: amount,
      amountDestination: fromMinorUnits(amountDestinationMinor, destinationCurrency),
      rateUsed: rate,
    };
  }

  async trade(
    user: User,
    fromCurrency: string,
    toCurrency: string,
    amount: number,
    idempotencyKey?: string,
  ): Promise<{
    fromCurrency: string;
    toCurrency: string;
    amountFrom: number;
    amountTo: number;
    rateUsed: number;
  }> {
    return this.convert(user, fromCurrency, toCurrency, amount, idempotencyKey).then((r) => ({
      fromCurrency: r.sourceCurrency,
      toCurrency: r.destinationCurrency,
      amountFrom: r.amountSource,
      amountTo: r.amountDestination,
      rateUsed: r.rateUsed,
    }));
  }
}
