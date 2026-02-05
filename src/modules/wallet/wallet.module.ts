import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletBalance } from './entities/wallet-balance.entity';
import { WalletRepository } from './wallet.repository';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { FxModule } from '../fx/fx.module';
import { TransactionModule } from '../transactions/transaction.module';
import { APP_REPOSITORIES } from '../../constants/repositories';

@Module({
  imports: [
    TypeOrmModule.forFeature([WalletBalance]),
    FxModule,
    TransactionModule,
  ],
  controllers: [WalletController],
  providers: [
    WalletRepository,
    WalletService,
    { provide: APP_REPOSITORIES.WALLET, useExisting: WalletRepository },
  ],
  exports: [WalletRepository, WalletService, APP_REPOSITORIES.WALLET],
})
export class WalletModule {}
