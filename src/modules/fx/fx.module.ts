import { Module } from '@nestjs/common';
import { FxController } from './fx.controller';
import { FxRatesService } from './fx-rates.service';

@Module({
  controllers: [FxController],
  providers: [FxRatesService],
  exports: [FxRatesService],
})
export class FxModule {}
