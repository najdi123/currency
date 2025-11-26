import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ManagedItem,
  ManagedItemDocument,
  ItemSource,
} from '../schemas/managed-item.schema';
import {
  OHLCPermanent,
  OHLCPermanentDocument,
} from '../navasan/schemas/ohlc-permanent.schema';
import {
  CreateManagedItemDto,
  UpdateManagedItemDto,
  OverridePriceDto,
  ManagedItemResponseDto,
  ManagedItemListResponseDto,
  DiagnosticDataResponseDto,
  ListManagedItemsQueryDto,
} from './dto';
import { AdminOverrideService } from './admin-override.service';

/**
 * AdminService
 *
 * Business logic for admin operations on managed items.
 * Provides CRUD operations and price override functionality.
 *
 * Key responsibilities:
 * - Manage item configurations
 * - Apply/remove price overrides
 * - Fetch current prices from ohlc_permanent
 * - Provide diagnostic data for debugging
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectModel(ManagedItem.name)
    private readonly managedItemModel: Model<ManagedItemDocument>,
    @InjectModel(OHLCPermanent.name)
    private readonly ohlcPermanentModel: Model<OHLCPermanentDocument>,
    private readonly adminOverrideService: AdminOverrideService,
  ) {}

  // ==================== CRUD OPERATIONS ====================

  /**
   * List all managed items with optional filtering and pagination
   */
  async listItems(
    query: ListManagedItemsQueryDto,
  ): Promise<ManagedItemListResponseDto> {
    const {
      category,
      source,
      isActive,
      isOverridden,
      search,
      page = 1,
      limit = 50,
      includePrices = true,
    } = query;

    // Build filter
    const filter: Record<string, unknown> = {};

    if (category) filter.category = category;
    if (source) filter.source = source;
    if (typeof isActive === 'boolean') filter.isActive = isActive;
    if (typeof isOverridden === 'boolean') filter.isOverridden = isOverridden;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { nameAr: { $regex: search, $options: 'i' } },
        { nameFa: { $regex: search, $options: 'i' } },
      ];
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.managedItemModel
        .find(filter)
        .sort({ category: 1, displayOrder: 1, code: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.managedItemModel.countDocuments(filter).exec(),
    ]);

    // Optionally enrich with current prices
    let enrichedItems = items.map((item) => this.toResponseDto(item));

    if (includePrices && items.length > 0) {
      enrichedItems = await this.enrichWithPrices(enrichedItems);
    }

    return {
      items: enrichedItems,
      total,
      page,
      limit,
    };
  }

  /**
   * Get a single item by code
   */
  async getItem(code: string): Promise<ManagedItemResponseDto> {
    const item = await this.managedItemModel
      .findOne({ code: code.toLowerCase() })
      .lean()
      .exec();

    if (!item) {
      throw new NotFoundException(`Item with code '${code}' not found`);
    }

    const responseDto = this.toResponseDto(item);
    const [enriched] = await this.enrichWithPrices([responseDto]);
    return enriched;
  }

  /**
   * Get all items in a group (by parentCode)
   */
  async getItemsByGroup(parentCode: string): Promise<ManagedItemResponseDto[]> {
    const items = await this.managedItemModel
      .find({ parentCode: parentCode.toLowerCase() })
      .sort({ displayOrder: 1 })
      .lean()
      .exec();

    if (items.length === 0) {
      throw new NotFoundException(
        `No items found with parent code '${parentCode}'`,
      );
    }

    const responseDtos = items.map((item) => this.toResponseDto(item));
    return this.enrichWithPrices(responseDtos);
  }

  /**
   * Create a new managed item
   */
  async createItem(
    dto: CreateManagedItemDto,
    adminUserId?: string,
  ): Promise<ManagedItemResponseDto> {
    // Check for duplicate code
    const existing = await this.managedItemModel
      .findOne({ code: dto.code.toLowerCase() })
      .exec();

    if (existing) {
      throw new ConflictException(`Item with code '${dto.code}' already exists`);
    }

    // Build the document
    const itemData: Partial<ManagedItem> = {
      code: dto.code.toLowerCase(),
      ohlcCode: dto.ohlcCode?.toUpperCase() || dto.code.toUpperCase(),
      parentCode: dto.parentCode?.toLowerCase(),
      name: dto.name,
      nameAr: dto.nameAr,
      nameFa: dto.nameFa,
      variant: dto.variant,
      category: dto.category,
      icon: dto.icon,
      displayOrder: dto.displayOrder ?? 999,
      isActive: dto.isActive ?? true,
      source: dto.source ?? ItemSource.API,
      hasApiData: dto.hasApiData ?? (dto.source !== ItemSource.MANUAL),
    };

    // If manual source with override price, set override fields
    if (dto.source === ItemSource.MANUAL && dto.overridePrice !== undefined) {
      itemData.isOverridden = true;
      itemData.overridePrice = dto.overridePrice;
      itemData.overrideAt = new Date();
      if (adminUserId) {
        itemData.overrideBy = new Types.ObjectId(adminUserId);
      }
    }

    const item = new this.managedItemModel(itemData);
    const saved = await item.save();

    this.logger.log(`Created managed item: ${dto.code}`);

    return this.toResponseDto(saved.toObject());
  }

  /**
   * Update an existing managed item
   */
  async updateItem(
    code: string,
    dto: UpdateManagedItemDto,
  ): Promise<ManagedItemResponseDto> {
    const item = await this.managedItemModel
      .findOneAndUpdate(
        { code: code.toLowerCase() },
        { $set: dto },
        { new: true, runValidators: true },
      )
      .lean()
      .exec();

    if (!item) {
      throw new NotFoundException(`Item with code '${code}' not found`);
    }

    this.logger.log(`Updated managed item: ${code}`);

    const responseDto = this.toResponseDto(item);
    const [enriched] = await this.enrichWithPrices([responseDto]);
    return enriched;
  }

  /**
   * Delete a managed item
   */
  async deleteItem(code: string): Promise<void> {
    const result = await this.managedItemModel
      .deleteOne({ code: code.toLowerCase() })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException(`Item with code '${code}' not found`);
    }

    this.logger.log(`Deleted managed item: ${code}`);
  }

  // ==================== OVERRIDE OPERATIONS ====================

  /**
   * Set price override for an item
   */
  async setOverride(
    code: string,
    dto: OverridePriceDto,
    adminUserId: string,
  ): Promise<ManagedItemResponseDto> {
    const updateData: Partial<ManagedItem> = {
      isOverridden: true,
      overridePrice: dto.price,
      overrideChange: dto.change,
      overrideReason: dto.reason,
      overrideAt: new Date(),
      overrideBy: new Types.ObjectId(adminUserId),
    };

    const item = await this.managedItemModel
      .findOneAndUpdate(
        { code: code.toLowerCase() },
        { $set: updateData },
        { new: true, runValidators: true },
      )
      .lean()
      .exec();

    if (!item) {
      throw new NotFoundException(`Item with code '${code}' not found`);
    }

    // Clear the override cache so new requests get updated data
    this.adminOverrideService.clearCache();

    this.logger.log(
      `Set price override for ${code}: ${dto.price} by admin ${adminUserId}`,
    );

    const responseDto = this.toResponseDto(item);
    const [enriched] = await this.enrichWithPrices([responseDto]);
    return enriched;
  }

  /**
   * Remove price override from an item
   */
  async removeOverride(code: string): Promise<ManagedItemResponseDto> {
    const item = await this.managedItemModel
      .findOneAndUpdate(
        { code: code.toLowerCase() },
        {
          $set: { isOverridden: false },
          $unset: {
            overridePrice: 1,
            overrideChange: 1,
            overrideReason: 1,
            overrideAt: 1,
            overrideBy: 1,
          },
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!item) {
      throw new NotFoundException(`Item with code '${code}' not found`);
    }

    // Clear the override cache so new requests get updated data
    this.adminOverrideService.clearCache();

    this.logger.log(`Removed price override for ${code}`);

    const responseDto = this.toResponseDto(item);
    const [enriched] = await this.enrichWithPrices([responseDto]);
    return enriched;
  }

  // ==================== DIAGNOSTIC OPERATIONS ====================

  /**
   * Get diagnostic data for an item - shows all data sources
   */
  async getDiagnosticData(itemCode: string): Promise<DiagnosticDataResponseDto> {
    const upperCode = itemCode.toUpperCase();
    const lowerCode = itemCode.toLowerCase();

    // Get managed item
    const managedItem = await this.managedItemModel
      .findOne({ $or: [{ code: lowerCode }, { ohlcCode: upperCode }] })
      .lean()
      .exec();

    // Get latest OHLC data
    const ohlcData = await this.ohlcPermanentModel
      .findOne({ itemCode: upperCode })
      .sort({ timestamp: -1 })
      .lean()
      .exec();

    // Determine effective price
    let effectivePrice: number | null = null;
    let effectiveSource: 'override' | 'ohlc' | 'none' = 'none';

    if (managedItem?.isOverridden && managedItem.overridePrice !== undefined) {
      effectivePrice = managedItem.overridePrice;
      effectiveSource = 'override';
    } else if (ohlcData) {
      effectivePrice = ohlcData.close;
      effectiveSource = 'ohlc';
    }

    return {
      itemCode: upperCode,
      managedItem: managedItem ? this.toResponseDto(managedItem) : undefined,
      ohlcData: ohlcData
        ? {
            timeframe: ohlcData.timeframe,
            timestamp: ohlcData.timestamp,
            open: ohlcData.open,
            high: ohlcData.high,
            low: ohlcData.low,
            close: ohlcData.close,
            source: ohlcData.source,
          }
        : undefined,
      sources: {
        hasManagedItem: !!managedItem,
        hasOhlcData: !!ohlcData,
        isOverridden: managedItem?.isOverridden ?? false,
        effectivePrice,
        effectiveSource,
      },
    };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Convert database document to response DTO
   */
  private toResponseDto(
    item: ManagedItem & { createdAt?: Date; updatedAt?: Date },
  ): ManagedItemResponseDto {
    return {
      code: item.code,
      ohlcCode: item.ohlcCode,
      parentCode: item.parentCode,
      name: item.name,
      nameAr: item.nameAr,
      nameFa: item.nameFa,
      variant: item.variant,
      category: item.category,
      icon: item.icon,
      displayOrder: item.displayOrder,
      isActive: item.isActive,
      source: item.source,
      hasApiData: item.hasApiData,
      isOverridden: item.isOverridden,
      overridePrice: item.overridePrice,
      overrideChange: item.overrideChange,
      overrideReason: item.overrideReason,
      overrideAt: item.overrideAt,
      overrideBy: item.overrideBy?.toString(),
      lastApiUpdate: item.lastApiUpdate,
      createdAt: item.createdAt || new Date(),
      updatedAt: item.updatedAt || new Date(),
    };
  }

  /**
   * Enrich items with current prices from ohlc_permanent
   */
  private async enrichWithPrices(
    items: ManagedItemResponseDto[],
  ): Promise<ManagedItemResponseDto[]> {
    if (items.length === 0) return items;

    // Get OHLC codes
    const ohlcCodes = items.map((item) => item.ohlcCode);

    // Fetch latest prices from ohlc_permanent
    // Using aggregation to get the latest record per item
    const latestPrices = await this.ohlcPermanentModel
      .aggregate([
        { $match: { itemCode: { $in: ohlcCodes } } },
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: '$itemCode',
            close: { $first: '$close' },
            open: { $first: '$open' },
            timestamp: { $first: '$timestamp' },
          },
        },
      ])
      .exec();

    // Create lookup map
    const priceMap = new Map<
      string,
      { close: number; open: number; timestamp: Date }
    >();
    for (const price of latestPrices) {
      priceMap.set(price._id, {
        close: price.close,
        open: price.open,
        timestamp: price.timestamp,
      });
    }

    // Enrich items
    return items.map((item) => {
      const priceData = priceMap.get(item.ohlcCode);

      // If overridden, use override values
      if (item.isOverridden && item.overridePrice !== undefined) {
        return {
          ...item,
          currentPrice: item.overridePrice,
          currentChange: item.overrideChange,
          priceTimestamp: item.overrideAt,
        };
      }

      // Otherwise use OHLC data
      if (priceData) {
        return {
          ...item,
          currentPrice: priceData.close,
          currentChange: priceData.close - priceData.open,
          priceTimestamp: priceData.timestamp,
        };
      }

      return item;
    });
  }

  // ==================== BULK OPERATIONS ====================

  /**
   * Get all overridden items (for MarketDataOrchestratorService)
   */
  async getOverriddenItems(): Promise<Map<string, { price: number; change?: number }>> {
    const items = await this.managedItemModel
      .find({ isOverridden: true, isActive: true })
      .select('code ohlcCode overridePrice overrideChange')
      .lean()
      .exec();

    const map = new Map<string, { price: number; change?: number }>();
    for (const item of items) {
      if (item.overridePrice !== undefined) {
        // Store by both codes for flexible lookup
        map.set(item.code.toLowerCase(), {
          price: item.overridePrice,
          change: item.overrideChange,
        });
        map.set(item.ohlcCode.toUpperCase(), {
          price: item.overridePrice,
          change: item.overrideChange,
        });
      }
    }

    return map;
  }

  /**
   * Get all active managed items by category (for MarketDataOrchestratorService)
   */
  async getActiveItemsByCategory(
    category: string,
  ): Promise<ManagedItem[]> {
    return this.managedItemModel
      .find({ category, isActive: true })
      .sort({ displayOrder: 1 })
      .lean()
      .exec();
  }

  /**
   * Update lastApiUpdate timestamp for items
   */
  async updateLastApiTimestamp(codes: string[]): Promise<void> {
    const lowerCodes = codes.map((c) => c.toLowerCase());
    await this.managedItemModel
      .updateMany(
        { code: { $in: lowerCodes } },
        { $set: { lastApiUpdate: new Date() } },
      )
      .exec();
  }
}
