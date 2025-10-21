import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { CurrenciesService } from './currencies.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Post()
  create(@Body() createCurrencyDto: CreateCurrencyDto) {
    return this.currenciesService.create(createCurrencyDto);
  }

  @Get()
  findAll(@Query('active') active?: string) {
    if (active === 'true') {
      return this.currenciesService.findActive();
    }
    return this.currenciesService.findAll();
  }

  @Get('code/:code')
  findByCode(@Param('code') code: string) {
    return this.currenciesService.findByCode(code);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.currenciesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCurrencyDto: UpdateCurrencyDto) {
    return this.currenciesService.update(id, updateCurrencyDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.currenciesService.remove(id);
  }
}
