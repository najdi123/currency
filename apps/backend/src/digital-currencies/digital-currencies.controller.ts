import { Controller, Get, Param, Query } from '@nestjs/common';
import { DigitalCurrenciesService } from './digital-currencies.service';

@Controller('digital-currencies')
export class DigitalCurrenciesController {
  constructor(private readonly digitalCurrenciesService: DigitalCurrenciesService) {}

  @Get('symbol/:symbol/history')
  getHistory(@Param('symbol') symbol: string, @Query('days') days?: string) {
    const daysNumber = days ? parseInt(days, 10) : 7;
    return this.digitalCurrenciesService.getHistory(symbol, daysNumber);
  }
}
