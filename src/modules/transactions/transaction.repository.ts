import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { APP_REPOSITORIES } from '../../constants/repositories';

@Injectable()
export class TransactionRepository {
  constructor(
    @InjectRepository(Transaction)
    private readonly repo: Repository<Transaction>,
  ) {}

  getRepository(): Repository<Transaction> {
    return this.repo;
  }

  async create(
    data: Partial<Transaction>,
    queryRunner?: { manager: any },
  ): Promise<Transaction> {
    const manager = queryRunner?.manager ?? this.repo.manager;
    const entity = manager.getRepository(Transaction).create(data);
    return manager.getRepository(Transaction).save(entity);
  }

  async findByIdempotencyKey(key: string): Promise<Transaction | null> {
    return this.repo.findOne({ where: { idempotencyKey: key } });
  }

  async findByUserId(
    userId: string,
    options?: { type?: TransactionType; limit?: number; offset?: number },
  ): Promise<Transaction[]> {
    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.userId = :userId', { userId })
      .orderBy('t.createdAt', 'DESC');
    if (options?.type) qb.andWhere('t.type = :type', { type: options.type });
    if (options?.limit) qb.take(options.limit);
    if (options?.offset) qb.skip(options.offset);
    return qb.getMany();
  }
}
