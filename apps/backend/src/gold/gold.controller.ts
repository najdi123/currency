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
import { GoldService } from './gold.service';
import { CreateGoldDto } from './dto/create-gold.dto';
import { UpdateGoldDto } from './dto/update-gold.dto';

@Controller('gold')
export class GoldController {
  constructor(private readonly goldService: GoldService) {}

  @Post()
  create(@Body() createGoldDto: CreateGoldDto) {
    return this.goldService.create(createGoldDto);
  }

  @Get()
  findAll(@Query('active') active?: string) {
    if (active === 'true') {
      return this.goldService.findActive();
    }
    return this.goldService.findAll();
  }

  @Get('purity/:minPurity')
  findByPurity(@Param('minPurity') minPurity: string) {
    return this.goldService.findByPurity(parseFloat(minPurity));
  }

  @Get('type/:type')
  findByType(@Param('type') type: string) {
    return this.goldService.findByType(type);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.goldService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGoldDto: UpdateGoldDto) {
    return this.goldService.update(id, updateGoldDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.goldService.remove(id);
  }
}
