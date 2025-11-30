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
} from '../market-data/schemas/ohlc-permanent.schema';
import {
  CreateManagedItemDto,
  UpdateManagedItemDto,
  OverridePriceDto,
  ManagedItemResponseDto,
  ManagedItemListResponseDto,
  DiagnosticDataResponseDto,
  ListManagedItemsQueryDto,
} from './dto';
import { DEFAULT_OVERRIDE_DURATION } from './dto/override-price.dto';
import { AdminOverrideService } from './admin-override.service';
import { Cron, CronExpression } from '@nestjs/schedule';

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
      region: dto.region,
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
   *
   * @param code - Item code
   * @param dto - Override data including price, duration, and isIndefinite flag
   * @param adminUserId - Admin user ID setting the override
   *
   * Duration behavior:
   * - If isIndefinite=true: Override never expires (overrideExpiresAt=null)
   * - If duration is provided: Override expires after that many minutes
   * - If neither: Default duration of 60 minutes (1 hour)
   */
  async setOverride(
    code: string,
    dto: OverridePriceDto,
    adminUserId: string,
  ): Promise<ManagedItemResponseDto> {
    const overrideAt = new Date();

    // Determine duration and expiration
    const isIndefinite = dto.isIndefinite === true;
    const duration = isIndefinite ? undefined : (dto.duration ?? DEFAULT_OVERRIDE_DURATION);
    const expiresAt = isIndefinite || duration === undefined
      ? undefined
      : new Date(overrideAt.getTime() + duration * 60 * 1000);

    const updateData: Partial<ManagedItem> = {
      isOverridden: true,
      overridePrice: dto.price,
      overrideChange: dto.change,
      overrideReason: dto.reason,
      overrideAt,
      overrideBy: new Types.ObjectId(adminUserId),
      overrideDuration: duration,
      overrideExpiresAt: expiresAt,
    };

    // Build the update operation
    const updateOperation: Record<string, unknown> = { $set: updateData };

    // If indefinite, unset the expiration fields
    if (isIndefinite) {
      updateOperation.$unset = {
        overrideDuration: 1,
        overrideExpiresAt: 1,
      };
      // Remove from $set since we're unsetting
      delete (updateOperation.$set as Partial<ManagedItem>).overrideDuration;
      delete (updateOperation.$set as Partial<ManagedItem>).overrideExpiresAt;
    }

    const item = await this.managedItemModel
      .findOneAndUpdate(
        { code: code.toLowerCase() },
        updateOperation,
        { new: true, runValidators: true },
      )
      .lean()
      .exec();

    if (!item) {
      throw new NotFoundException(`Item with code '${code}' not found`);
    }

    // Clear the override cache so new requests get updated data
    this.adminOverrideService.clearCache();

    const durationStr = isIndefinite
      ? 'indefinite'
      : `${duration} minutes (expires at ${expiresAt?.toISOString()})`;
    this.logger.log(
      `Set price override for ${code}: ${dto.price} by admin ${adminUserId}, duration: ${durationStr}`,
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
            overrideDuration: 1,
            overrideExpiresAt: 1,
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
      region: item.region,
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
      overrideDuration: item.overrideDuration,
      overrideExpiresAt: item.overrideExpiresAt,
      lastApiUpdate: item.lastApiUpdate,
      createdAt: item.createdAt || new Date(),
      updatedAt: item.updatedAt || new Date(),
    };
  }

  /**
   * Check if an override has expired
   */
  private isOverrideExpired(item: ManagedItemResponseDto): boolean {
    // If not overridden, not applicable
    if (!item.isOverridden) return false;

    // If no expiration set (indefinite), never expires
    if (!item.overrideExpiresAt) return false;

    // Check if expiration time has passed
    return new Date() > new Date(item.overrideExpiresAt);
  }

  /**
   * Enrich items with current prices from ohlc_permanent
   *
   * Also checks for expired overrides - if an override has expired,
   * it falls back to OHLC data instead of the override price.
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

      // Check if override is active and not expired
      const isOverrideActive = item.isOverridden &&
        item.overridePrice !== undefined &&
        !this.isOverrideExpired(item);

      // If override is active, use override values
      if (isOverrideActive) {
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

  // ==================== MIGRATION / INITIALIZATION ====================

  /**
   * Initialize managed_items collection from ohlc_permanent data
   * This creates entries for all unique items found in ohlc_permanent
   *
   * Optimized to use batch operations instead of N+1 queries
   */
  async initializeFromOhlc(): Promise<{ created: number; skipped: number; items: string[] }> {
    this.logger.log('Initializing managed_items from ohlc_permanent...');

    // Get all unique item codes from ohlc_permanent
    const uniqueItems = await this.ohlcPermanentModel
      .aggregate([
        { $group: { _id: '$itemCode', itemType: { $first: '$itemType' } } },
        { $sort: { _id: 1 } },
      ])
      .exec();

    this.logger.log(`Found ${uniqueItems.length} unique items in ohlc_permanent`);

    // Item name mappings (can be expanded)
    const itemNames: Record<string, { name: string; nameFa: string; nameAr: string }> = {
      // Currencies
      USD_SELL: { name: 'US Dollar (Sell)', nameFa: 'دلار آمریکا (فروش)', nameAr: 'الدولار الأمريكي (بيع)' },
      USD_BUY: { name: 'US Dollar (Buy)', nameFa: 'دلار آمریکا (خرید)', nameAr: 'الدولار الأمريكي (شراء)' },
      EUR: { name: 'Euro', nameFa: 'یورو', nameAr: 'اليورو' },
      GBP: { name: 'British Pound', nameFa: 'پوند انگلیس', nameAr: 'الجنيه الإسترليني' },
      AED: { name: 'UAE Dirham', nameFa: 'درهم امارات', nameAr: 'الدرهم الإماراتي' },
      TRY: { name: 'Turkish Lira', nameFa: 'لیر ترکیه', nameAr: 'الليرة التركية' },
      CAD: { name: 'Canadian Dollar', nameFa: 'دلار کانادا', nameAr: 'الدولار الكندي' },
      AUD: { name: 'Australian Dollar', nameFa: 'دلار استرالیا', nameAr: 'الدولار الأسترالي' },
      CHF: { name: 'Swiss Franc', nameFa: 'فرانک سوئیس', nameAr: 'الفرنك السويسري' },
      CNY: { name: 'Chinese Yuan', nameFa: 'یوان چین', nameAr: 'اليوان الصيني' },
      JPY: { name: 'Japanese Yen', nameFa: 'ین ژاپن', nameAr: 'الين الياباني' },
      // Crypto
      BTC: { name: 'Bitcoin', nameFa: 'بیت‌کوین', nameAr: 'بيتكوين' },
      ETH: { name: 'Ethereum', nameFa: 'اتریوم', nameAr: 'إيثريوم' },
      USDT: { name: 'Tether', nameFa: 'تتر', nameAr: 'تيثر' },
      BNB: { name: 'Binance Coin', nameFa: 'بایننس کوین', nameAr: 'عملة بينانس' },
      XRP: { name: 'Ripple', nameFa: 'ریپل', nameAr: 'ريبل' },
      ADA: { name: 'Cardano', nameFa: 'کاردانو', nameAr: 'كاردانو' },
      DOGE: { name: 'Dogecoin', nameFa: 'دوج‌کوین', nameAr: 'دوجكوين' },
      SOL: { name: 'Solana', nameFa: 'سولانا', nameAr: 'سولانا' },
      // Gold
      SEKKEH: { name: 'Emami Gold Coin', nameFa: 'سکه امامی', nameAr: 'عملة ذهب إمامي' },
      BAHAR: { name: 'Bahar Azadi Coin', nameFa: 'سکه بهار آزادی', nameAr: 'عملة بهار آزادي' },
      NIM: { name: 'Half Gold Coin', nameFa: 'نیم سکه', nameAr: 'نصف عملة ذهب' },
      ROB: { name: 'Quarter Gold Coin', nameFa: 'ربع سکه', nameAr: 'ربع عملة ذهب' },
      GERAMI: { name: 'Gerami Gold Coin', nameFa: 'سکه گرمی', nameAr: 'عملة ذهب غرامي' },
      '18AYAR': { name: '18K Gold', nameFa: 'طلای ۱۸ عیار', nameAr: 'ذهب 18 قيراط' },
      ABSHODEH: { name: 'Melted Gold', nameFa: 'طلای آب‌شده', nameAr: 'ذهب مذاب' },
    };

    // Category mappings
    const getCategory = (itemType: string): string => {
      if (itemType === 'crypto') return 'crypto';
      if (itemType === 'gold') return 'gold';
      return 'currencies';
    };

    // BATCH CHECK: Get all existing codes in a single query instead of N queries
    const allLowerCodes = uniqueItems.map((item) => (item._id as string).toLowerCase());
    const existingItems = await this.managedItemModel
      .find({ code: { $in: allLowerCodes } })
      .select('code')
      .lean()
      .exec();
    const existingCodesSet = new Set(existingItems.map((item) => item.code));

    this.logger.log(`Found ${existingCodesSet.size} existing managed items`);

    // Filter to only items that need to be created
    const itemsToCreate = uniqueItems.filter(
      (item) => !existingCodesSet.has((item._id as string).toLowerCase())
    );

    if (itemsToCreate.length === 0) {
      this.logger.log('No new items to create - all items already exist');
      return { created: 0, skipped: uniqueItems.length, items: [] };
    }

    // Prepare batch insert documents
    const documentsToInsert = itemsToCreate.map((item) => {
      const code = item._id as string;
      const itemType = item.itemType as string;
      const lowerCode = code.toLowerCase();

      const names = itemNames[code] || {
        name: code.replace(/_/g, ' '),
        nameFa: code.replace(/_/g, ' '),
        nameAr: code.replace(/_/g, ' '),
      };

      return {
        code: lowerCode,
        ohlcCode: code,
        name: names.name,
        nameFa: names.nameFa,
        nameAr: names.nameAr,
        category: getCategory(itemType),
        source: ItemSource.API,
        hasApiData: true,
        isActive: true,
        displayOrder: 999,
      };
    });

    // BATCH INSERT: Insert all new items in a single operation
    const insertResult = await this.managedItemModel.insertMany(documentsToInsert, {
      ordered: false, // Continue inserting even if some fail (e.g., duplicate key)
    });

    const created = insertResult.length;
    const skipped = uniqueItems.length - created;
    const createdItems = documentsToInsert.map((doc) => doc.code);

    this.logger.log(`Initialization complete: ${created} created, ${skipped} skipped`);

    return { created, skipped, items: createdItems };
  }

  // ==================== SCHEDULED TASKS ====================

  /**
   * Clear expired price overrides
   *
   * This scheduled task runs every minute to find and clear overrides
   * that have passed their expiration time. This ensures prices
   * automatically revert to API values after the specified duration.
   *
   * Query uses the compound index: { isOverridden: 1, overrideExpiresAt: 1 }
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async clearExpiredOverrides(): Promise<void> {
    const now = new Date();

    // Find all expired overrides
    // Query: isOverridden=true AND overrideExpiresAt exists AND overrideExpiresAt < now
    const expiredItems = await this.managedItemModel
      .find({
        isOverridden: true,
        overrideExpiresAt: { $exists: true, $ne: null, $lt: now },
      })
      .select('code overrideExpiresAt')
      .lean()
      .exec();

    if (expiredItems.length === 0) {
      return; // No expired overrides, nothing to do
    }

    const expiredCodes = expiredItems.map((item) => item.code);

    this.logger.log(
      `Found ${expiredItems.length} expired override(s): ${expiredCodes.join(', ')}`,
    );

    // Clear all expired overrides in a single operation
    const result = await this.managedItemModel
      .updateMany(
        {
          isOverridden: true,
          overrideExpiresAt: { $exists: true, $ne: null, $lt: now },
        },
        {
          $set: { isOverridden: false },
          $unset: {
            overridePrice: 1,
            overrideChange: 1,
            overrideReason: 1,
            overrideAt: 1,
            overrideBy: 1,
            overrideDuration: 1,
            overrideExpiresAt: 1,
          },
        },
      )
      .exec();

    if (result.modifiedCount > 0) {
      // Clear the override cache so new requests get updated data
      this.adminOverrideService.clearCache();

      this.logger.log(
        `Cleared ${result.modifiedCount} expired override(s): ${expiredCodes.join(', ')}`,
      );
    }
  }
}
