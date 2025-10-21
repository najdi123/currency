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
import { DigitalCurrenciesService } from './digital-currencies.service';
import { CreateDigitalCurrencyDto } from './dto/create-digital-currency.dto';
import { UpdateDigitalCurrencyDto } from './dto/update-digital-currency.dto';

@Controller('digital-currencies')
export class DigitalCurrenciesController {
  constructor(private readonly digitalCurrenciesService: DigitalCurrenciesService) {}

  @Post()
  create(@Body() createDigitalCurrencyDto: CreateDigitalCurrencyDto) {
    return this.digitalCurrenciesService.create(createDigitalCurrencyDto);
  }

  @Get()
  findAll(@Query('active') active?: string) {
    if (active === 'true') {
      return this.digitalCurrenciesService.findActive();
    }
    return this.digitalCurrenciesService.findAll();
  }

  @Get('top')
  getTopByMarketCap(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.digitalCurrenciesService.getTopByMarketCap(limitNumber);
  }

  @Get('symbol/:symbol')
  findBySymbol(@Param('symbol') symbol: string) {
    return this.digitalCurrenciesService.findBySymbol(symbol);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.digitalCurrenciesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDigitalCurrencyDto: UpdateDigitalCurrencyDto,
  ) {
    return this.digitalCurrenciesService.update(id, updateDigitalCurrencyDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.digitalCurrenciesService.remove(id);
  }
}
