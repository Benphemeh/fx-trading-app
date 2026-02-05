import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WalletBalance } from './entities/wallet-balance.entity';
import { APP_REPOSITORIES } from '../../constants/repositories';

@Injectable()
export class WalletRepository {
  constructor(
    @InjectRepository(WalletBalance)
    private readonly repo: Repository<WalletBalance>,
    private readonly dataSource: DataSource,
  ) {}

  getRepository(): Repository<WalletBalance> {
    return this.repo;
  }

  async findByUserId(userId: string): Promise<WalletBalance[]> {
    return this.repo.find({ where: { userId }, order: { currency: 'ASC' } });
  }

  async findByUserAndCurrency(
    userId: string,
    currency: string,
  ): Promise<WalletBalance | null> {
    return this.repo.findOne({ where: { userId, currency } });
  }

  async lockForUpdate(
    userId: string,
    currency: string,
    queryRunner: { manager: import('typeorm').EntityManager },
  ): Promise<WalletBalance | null> {
    const repo = queryRunner.manager.getRepository(WalletBalance);
    return repo
      .createQueryBuilder('wb')
      .setLock('pessimistic_write')
      .where('wb.userId = :userId', { userId })
      .andWhere('wb.currency = :currency', { currency })
      .getOne();
  }

  async getOrCreate(
    userId: string,
    currency: string,
    queryRunner: { manager: any },
  ): Promise<WalletBalance> {
    const repo = queryRunner.manager.getRepository(WalletBalance);
    let row = await repo.findOne({ where: { userId, currency } });
    if (!row) {
      row = repo.create({ userId, currency, balanceMinor: '0' });
      await repo.save(row);
    }
    return row;
  }

  async addBalance(
    userId: string,
    currency: string,
    deltaMinor: number,
    queryRunner: { manager: any },
  ): Promise<void> {
    const repo = queryRunner.manager.getRepository(WalletBalance);
    const safeDelta = Number(deltaMinor);
    await repo
      .createQueryBuilder()
      .update(WalletBalance)
      .set({ balanceMinor: () => `"balanceMinor" + ${safeDelta}` })
      .where('userId = :userId', { userId })
      .andWhere('currency = :currency', { currency })
      .execute();
  }

  async subtractBalance(
    userId: string,
    currency: string,
    amountMinor: number,
    queryRunner: { manager: any },
  ): Promise<boolean> {
    const repo = queryRunner.manager.getRepository(WalletBalance);
    const safeAmount = Number(amountMinor);
    const result = await repo
      .createQueryBuilder()
      .update(WalletBalance)
      .set({ balanceMinor: () => `"balanceMinor" - ${safeAmount}` })
      .where('userId = :userId', { userId })
      .andWhere('currency = :currency', { currency })
      .andWhere('"balanceMinor" >= :amount', { amount: safeAmount })
      .execute();
    return (result.affected ?? 0) > 0;
  }
}
