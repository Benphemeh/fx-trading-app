import { Injectable, Inject } from '@nestjs/common';
import { TransactionRepository } from './transaction.repository';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { APP_REPOSITORIES } from '../../constants/repositories';
import { fromMinorUnits } from '../../constants/currencies';

@Injectable()
export class TransactionService {
  constructor(
    @Inject(APP_REPOSITORIES.TRANSACTION)
    private readonly transactionRepo: TransactionRepository,
  ) {}

  async getHistory(
    userId: string,
    options?: { type?: TransactionType; limit?: number; offset?: number },
  ): Promise<
    {
      id: string;
      type: TransactionType;
      status: string;
      amount: number;
      currency: string;
      amountDestination: number | null;
      currencyDestination: string | null;
      rateUsed: number | null;
      createdAt: string;
    }[]
  > {
    const list = await this.transactionRepo.findByUserId(userId, {
      ...options,
      limit: options?.limit ?? 50,
    });
    return list.map((t) => this.formatTransaction(t));
  }

  async getAllHistory(options?: {
    type?: TransactionType;
    limit?: number;
    offset?: number;
  }): Promise<
    {
      id: string;
      userId: string;
      type: TransactionType;
      status: string;
      amount: number;
      currency: string;
      amountDestination: number | null;
      currencyDestination: string | null;
      rateUsed: number | null;
      createdAt: string;
    }[]
  > {
    const list = await this.transactionRepo.findAll({
      ...options,
      limit: options?.limit ?? 50,
    });
    return list.map((t) => ({
      ...this.formatTransaction(t),
      userId: t.userId,
    }));
  }

  private formatTransaction(t: Transaction) {
    return {
      id: t.id,
      type: t.type,
      status: t.status,
      amount: fromMinorUnits(Number(t.amountMinor), t.currency),
      currency: t.currency,
      amountDestination: t.amountDestinationMinor
        ? fromMinorUnits(Number(t.amountDestinationMinor), t.currencyDestination!)
        : null,
      currencyDestination: t.currencyDestination ?? null,
      rateUsed: t.rateUsed ? Number(t.rateUsed) : null,
      createdAt: t.createdAt.toISOString(),
    };
  }
}
