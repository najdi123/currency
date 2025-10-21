import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DigitalCurrenciesService } from './digital-currencies.service';
import { DigitalCurrenciesController } from './digital-currencies.controller';
import { DigitalCurrency, DigitalCurrencySchema } from './schemas/digital-currency.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DigitalCurrency.name, schema: DigitalCurrencySchema },
    ]),
  ],
  controllers: [DigitalCurrenciesController],
  providers: [DigitalCurrenciesService],
  exports: [DigitalCurrenciesService],
})
export class DigitalCurrenciesModule {}
