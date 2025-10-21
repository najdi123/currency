import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Gold, GoldDocument } from './schemas/gold.schema';
import { CreateGoldDto } from './dto/create-gold.dto';
import { UpdateGoldDto } from './dto/update-gold.dto';

@Injectable()
export class GoldService {
  private readonly logger = new Logger(GoldService.name);

  constructor(
    @InjectModel(Gold.name) private goldModel: Model<GoldDocument>,
  ) {}

  async create(createGoldDto: CreateGoldDto): Promise<Gold> {
    try {
      this.logger.log(`Creating gold entry: ${createGoldDto.type}`);
      const gold = new this.goldModel({
        ...createGoldDto,
        lastUpdated: new Date(),
      });
      return await gold.save();
    } catch (error: unknown) {
      // Check if error is a MongoDB duplicate key error
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        this.logger.warn(`Duplicate gold type: ${createGoldDto.type}`);
        throw new ConflictException(
          `Gold entry with type ${createGoldDto.type} already exists`,
        );
      }
      this.logger.error(`Failed to create gold entry: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async findAll(): Promise<Gold[]> {
    return this.goldModel.find().exec();
  }

  async findActive(): Promise<Gold[]> {
    return this.goldModel.find({ isActive: true }).exec();
  }

  async findOne(id: string): Promise<Gold> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid gold entry ID format');
    }
    const gold = await this.goldModel.findById(id).exec();
    if (!gold) {
      throw new NotFoundException(`Gold type with ID ${id} not found`);
    }
    return gold;
  }

  async findByType(type: string): Promise<Gold> {
    const gold = await this.goldModel.findOne({ type }).exec();
    if (!gold) {
      throw new NotFoundException(`Gold type ${type} not found`);
    }
    return gold;
  }

  async update(id: string, updateGoldDto: UpdateGoldDto): Promise<Gold> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid gold entry ID format');
    }
    const gold = await this.goldModel
      .findByIdAndUpdate(
        id,
        { ...updateGoldDto, lastUpdated: new Date() },
        { new: true },
      )
      .exec();

    if (!gold) {
      throw new NotFoundException(`Gold type with ID ${id} not found`);
    }
    this.logger.log(`Updated gold entry: ${id}`);
    return gold;
  }

  async remove(id: string): Promise<Gold> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid gold entry ID format');
    }
    const gold = await this.goldModel.findByIdAndDelete(id).exec();
    if (!gold) {
      throw new NotFoundException(`Gold type with ID ${id} not found`);
    }
    this.logger.log(`Removed gold entry: ${id}`);
    return gold;
  }

  async updatePrice(
    type: string,
    priceInToman: number,
    changePercentage24h?: number,
    changeAmount24h?: number,
  ): Promise<Gold> {
    const gold = await this.goldModel
      .findOneAndUpdate(
        { type },
        {
          priceInToman,
          changePercentage24h,
          changeAmount24h,
          lastUpdated: new Date(),
        },
        { new: true },
      )
      .exec();

    if (!gold) {
      throw new NotFoundException(`Gold type ${type} not found`);
    }
    return gold;
  }

  async findByPurity(minPurity: number): Promise<Gold[]> {
    return this.goldModel
      .find({ isActive: true, purity: { $gte: minPurity } })
      .sort({ purity: -1 })
      .exec();
  }
}
