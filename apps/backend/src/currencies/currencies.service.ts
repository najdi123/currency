import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Currency, CurrencyDocument } from './schemas/currency.schema';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

@Injectable()
export class CurrenciesService {
  private readonly logger = new Logger(CurrenciesService.name);

  constructor(
    @InjectModel(Currency.name) private currencyModel: Model<CurrencyDocument>,
  ) {}

  async create(createCurrencyDto: CreateCurrencyDto): Promise<Currency> {
    try {
      this.logger.log(`Creating currency: ${createCurrencyDto.code}`);
      const currency = new this.currencyModel({
        ...createCurrencyDto,
        lastUpdated: new Date(),
      });
      return await currency.save();
    } catch (error: unknown) {
      // Check if error is a MongoDB duplicate key error
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        this.logger.warn(`Duplicate currency code: ${createCurrencyDto.code}`);
        throw new ConflictException(
          `Currency with code ${createCurrencyDto.code} already exists`,
        );
      }
      this.logger.error(`Failed to create currency: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async findAll(): Promise<Currency[]> {
    return this.currencyModel.find().exec();
  }

  async findActive(): Promise<Currency[]> {
    return this.currencyModel.find({ isActive: true }).exec();
  }

  async findOne(id: string): Promise<Currency> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid currency ID format');
    }
    const currency = await this.currencyModel.findById(id).exec();
    if (!currency) {
      throw new NotFoundException(`Currency with ID ${id} not found`);
    }
    return currency;
  }

  async findByCode(code: string): Promise<Currency> {
    const currency = await this.currencyModel.findOne({ code }).exec();
    if (!currency) {
      throw new NotFoundException(`Currency with code ${code} not found`);
    }
    return currency;
  }

  async update(id: string, updateCurrencyDto: UpdateCurrencyDto): Promise<Currency> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid currency ID format');
    }
    const currency = await this.currencyModel
      .findByIdAndUpdate(
        id,
        { ...updateCurrencyDto, lastUpdated: new Date() },
        { new: true },
      )
      .exec();

    if (!currency) {
      throw new NotFoundException(`Currency with ID ${id} not found`);
    }
    this.logger.log(`Updated currency: ${id}`);
    return currency;
  }

  async remove(id: string): Promise<Currency> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid currency ID format');
    }
    const currency = await this.currencyModel.findByIdAndDelete(id).exec();
    if (!currency) {
      throw new NotFoundException(`Currency with ID ${id} not found`);
    }
    this.logger.log(`Removed currency: ${id}`);
    return currency;
  }

  async updatePrice(
    code: string,
    priceInToman: number,
    changePercentage24h?: number,
    changeAmount24h?: number,
  ): Promise<Currency> {
    const currency = await this.currencyModel
      .findOneAndUpdate(
        { code },
        {
          priceInToman,
          changePercentage24h,
          changeAmount24h,
          lastUpdated: new Date(),
        },
        { new: true },
      )
      .exec();

    if (!currency) {
      throw new NotFoundException(`Currency with code ${code} not found`);
    }
    return currency;
  }
}
