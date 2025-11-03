import { Module } from '@nestjs/common';
import { DigitalCurrenciesService } from './digital-currencies.service';
import { DigitalCurrenciesController } from './digital-currencies.controller';
import { HistoryModule } from '../history/history.module';

@Module({
  imports: [HistoryModule],
  controllers: [DigitalCurrenciesController],
  providers: [DigitalCurrenciesService],
  exports: [DigitalCurrenciesService],
})
export class DigitalCurrenciesModule {}
