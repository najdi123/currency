import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DigitalCurrency, DigitalCurrencyDocument } from './schemas/digital-currency.schema';
import { CreateDigitalCurrencyDto } from './dto/create-digital-currency.dto';
import { UpdateDigitalCurrencyDto } from './dto/update-digital-currency.dto';

@Injectable()
export class DigitalCurrenciesService {
  private readonly logger = new Logger(DigitalCurrenciesService.name);

  constructor(
    @InjectModel(DigitalCurrency.name)
    private digitalCurrencyModel: Model<DigitalCurrencyDocument>,
  ) {}

  async create(createDigitalCurrencyDto: CreateDigitalCurrencyDto): Promise<DigitalCurrency> {
    try {
      this.logger.log(`Creating digital currency: ${createDigitalCurrencyDto.symbol}`);
      const digitalCurrency = new this.digitalCurrencyModel({
        ...createDigitalCurrencyDto,
        lastUpdated: new Date(),
      });
      return await digitalCurrency.save();
    } catch (error: unknown) {
      // Check if error is a MongoDB duplicate key error
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        this.logger.warn(`Duplicate digital currency symbol: ${createDigitalCurrencyDto.symbol}`);
        throw new ConflictException(
          `Digital currency with symbol ${createDigitalCurrencyDto.symbol} already exists`,
        );
      }
      this.logger.error(`Failed to create digital currency: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async findAll(): Promise<DigitalCurrency[]> {
    return this.digitalCurrencyModel.find().exec();
  }

  async findActive(): Promise<DigitalCurrency[]> {
    return this.digitalCurrencyModel.find({ isActive: true }).exec();
  }

  async findOne(id: string): Promise<DigitalCurrency> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid digital currency ID format');
    }
    const digitalCurrency = await this.digitalCurrencyModel.findById(id).exec();
    if (!digitalCurrency) {
      throw new NotFoundException(`Digital currency with ID ${id} not found`);
    }
    return digitalCurrency;
  }

  async findBySymbol(symbol: string): Promise<DigitalCurrency> {
    const digitalCurrency = await this.digitalCurrencyModel
      .findOne({ symbol: symbol.toUpperCase() })
      .exec();
    if (!digitalCurrency) {
      throw new NotFoundException(`Digital currency with symbol ${symbol} not found`);
    }
    return digitalCurrency;
  }

  async update(
    id: string,
    updateDigitalCurrencyDto: UpdateDigitalCurrencyDto,
  ): Promise<DigitalCurrency> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid digital currency ID format');
    }
    const digitalCurrency = await this.digitalCurrencyModel
      .findByIdAndUpdate(
        id,
        { ...updateDigitalCurrencyDto, lastUpdated: new Date() },
        { new: true },
      )
      .exec();

    if (!digitalCurrency) {
      throw new NotFoundException(`Digital currency with ID ${id} not found`);
    }
    this.logger.log(`Updated digital currency: ${id}`);
    return digitalCurrency;
  }

  async remove(id: string): Promise<DigitalCurrency> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid digital currency ID format');
    }
    const digitalCurrency = await this.digitalCurrencyModel.findByIdAndDelete(id).exec();
    if (!digitalCurrency) {
      throw new NotFoundException(`Digital currency with ID ${id} not found`);
    }
    this.logger.log(`Removed digital currency: ${id}`);
    return digitalCurrency;
  }

  async getTopByMarketCap(limit: number = 10): Promise<DigitalCurrency[]> {
    return this.digitalCurrencyModel
      .find({ isActive: true })
      .sort({ marketCapInToman: -1 })
      .limit(limit)
      .exec();
  }

  async updatePrice(
    symbol: string,
    priceInToman: number,
    additionalData?: Partial<UpdateDigitalCurrencyDto>,
  ): Promise<DigitalCurrency> {
    const digitalCurrency = await this.digitalCurrencyModel
      .findOneAndUpdate(
        { symbol: symbol.toUpperCase() },
        {
          priceInToman,
          ...additionalData,
          lastUpdated: new Date(),
        },
        { new: true },
      )
      .exec();

    if (!digitalCurrency) {
      throw new NotFoundException(`Digital currency with symbol ${symbol} not found`);
    }
    return digitalCurrency;
  }
}
