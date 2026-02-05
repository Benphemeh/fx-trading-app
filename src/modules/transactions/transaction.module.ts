import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { TransactionRepository } from './transaction.repository';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { APP_REPOSITORIES } from '../../constants/repositories';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction])],
  controllers: [TransactionController],
  providers: [
    TransactionRepository,
    TransactionService,
    { provide: APP_REPOSITORIES.TRANSACTION, useExisting: TransactionRepository },
  ],
  exports: [APP_REPOSITORIES.TRANSACTION, TransactionRepository, TransactionService],
})
export class TransactionModule {}
