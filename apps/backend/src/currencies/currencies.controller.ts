import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrenciesService } from './currencies.service';

@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get('code/:code/history')
  getHistory(@Param('code') code: string, @Query('days') days?: string) {
    const daysNumber = days ? parseInt(days, 10) : 7;
    return this.currenciesService.getHistory(code, daysNumber);
  }
}
