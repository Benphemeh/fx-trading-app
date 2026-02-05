import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { UserModule } from '../user/user.module';
import { TransactionModule } from '../transactions/transaction.module';

@Module({
  imports: [UserModule, TransactionModule],
  controllers: [AdminController],
})
export class AdminModule {}
