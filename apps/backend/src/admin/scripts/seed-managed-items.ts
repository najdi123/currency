/**
 * Seed script for managed_items collection
 *
 * This script populates the managed_items collection with initial data
 * based on the existing CATEGORY_ITEM_CODES from market-data constants.
 *
 * Run with: npx ts-node -r tsconfig-paths/register src/admin/scripts/seed-managed-items.ts
 * Or via NestJS CLI if integrated
 */

import { NestFactory } from '@nestjs/core';
import { Module, Logger } from '@nestjs/common';
import { MongooseModule, InjectModel } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import {
  ManagedItem,
  ManagedItemDocument,
  ManagedItemSchema,
  ItemCategory,
  ItemSource,
  ItemVariant,
} from '../../schemas/managed-item.schema';

// Item definitions with display names
const ITEM_DEFINITIONS: Record<string, {
  name: string;
  nameAr?: string;
  nameFa?: string;
  category: ItemCategory;
  parentCode?: string;
  variant?: ItemVariant;
  icon?: string;
  displayOrder: number;
}> = {
  // Currencies
  usd_sell: {
    name: 'US Dollar (Sell)',
    nameAr: 'دلار آمریکا (فروش)',
    nameFa: 'دلار آمریکا (فروش)',
    category: ItemCategory.CURRENCY,
    parentCode: 'usd',
    variant: ItemVariant.SELL,
    icon: 'FaDollarSign',
    displayOrder: 1,
  },
  usd_buy: {
    name: 'US Dollar (Buy)',
    nameAr: 'دلار آمریکا (خرید)',
    nameFa: 'دلار آمریکا (خرید)',
    category: ItemCategory.CURRENCY,
    parentCode: 'usd',
    variant: ItemVariant.BUY,
    icon: 'FaDollarSign',
    displayOrder: 2,
  },
  eur: {
    name: 'Euro',
    nameAr: 'يورو',
    nameFa: 'یورو',
    category: ItemCategory.CURRENCY,
    icon: 'FaEuroSign',
    displayOrder: 3,
  },
  gbp: {
    name: 'British Pound',
    nameAr: 'جنيه استرليني',
    nameFa: 'پوند انگلیس',
    category: ItemCategory.CURRENCY,
    icon: 'FaPoundSign',
    displayOrder: 4,
  },
  cad: {
    name: 'Canadian Dollar',
    nameAr: 'دولار كندي',
    nameFa: 'دلار کانادا',
    category: ItemCategory.CURRENCY,
    displayOrder: 5,
  },
  aud: {
    name: 'Australian Dollar',
    nameAr: 'دولار أسترالي',
    nameFa: 'دلار استرالیا',
    category: ItemCategory.CURRENCY,
    displayOrder: 6,
  },
  aed: {
    name: 'UAE Dirham',
    nameAr: 'درهم إماراتي',
    nameFa: 'درهم امارات',
    category: ItemCategory.CURRENCY,
    parentCode: 'aed',
    displayOrder: 7,
  },
  aed_sell: {
    name: 'UAE Dirham (Sell)',
    nameAr: 'درهم إماراتي (فروش)',
    nameFa: 'درهم امارات (فروش)',
    category: ItemCategory.CURRENCY,
    parentCode: 'aed',
    variant: ItemVariant.SELL,
    displayOrder: 8,
  },
  dirham_dubai: {
    name: 'Dubai Dirham',
    nameAr: 'درهم دبي',
    nameFa: 'درهم دبی',
    category: ItemCategory.CURRENCY,
    displayOrder: 9,
  },
  cny: {
    name: 'Chinese Yuan',
    nameAr: 'يوان صيني',
    nameFa: 'یوان چین',
    category: ItemCategory.CURRENCY,
    icon: 'FaYenSign',
    displayOrder: 10,
  },
  try: {
    name: 'Turkish Lira',
    nameAr: 'ليرة تركية',
    nameFa: 'لیر ترکیه',
    category: ItemCategory.CURRENCY,
    icon: 'FaLiraSign',
    displayOrder: 11,
  },
  chf: {
    name: 'Swiss Franc',
    nameAr: 'فرنك سويسري',
    nameFa: 'فرانک سوئیس',
    category: ItemCategory.CURRENCY,
    displayOrder: 12,
  },
  jpy: {
    name: 'Japanese Yen',
    nameAr: 'ين ياباني',
    nameFa: 'ین ژاپن',
    category: ItemCategory.CURRENCY,
    icon: 'FaYenSign',
    displayOrder: 13,
  },
  rub: {
    name: 'Russian Ruble',
    nameAr: 'روبل روسي',
    nameFa: 'روبل روسیه',
    category: ItemCategory.CURRENCY,
    icon: 'FaRubleSign',
    displayOrder: 14,
  },
  inr: {
    name: 'Indian Rupee',
    nameAr: 'روبية هندية',
    nameFa: 'روپیه هند',
    category: ItemCategory.CURRENCY,
    icon: 'FaRupeeSign',
    displayOrder: 15,
  },
  pkr: {
    name: 'Pakistani Rupee',
    nameAr: 'روبية باكستانية',
    nameFa: 'روپیه پاکستان',
    category: ItemCategory.CURRENCY,
    displayOrder: 16,
  },
  iqd: {
    name: 'Iraqi Dinar',
    nameAr: 'دينار عراقي',
    nameFa: 'دینار عراق',
    category: ItemCategory.CURRENCY,
    displayOrder: 17,
  },
  kwd: {
    name: 'Kuwaiti Dinar',
    nameAr: 'دينار كويتي',
    nameFa: 'دینار کویت',
    category: ItemCategory.CURRENCY,
    displayOrder: 18,
  },
  sar: {
    name: 'Saudi Riyal',
    nameAr: 'ريال سعودي',
    nameFa: 'ریال عربستان',
    category: ItemCategory.CURRENCY,
    displayOrder: 19,
  },
  qar: {
    name: 'Qatari Riyal',
    nameAr: 'ريال قطري',
    nameFa: 'ریال قطر',
    category: ItemCategory.CURRENCY,
    displayOrder: 20,
  },
  omr: {
    name: 'Omani Rial',
    nameAr: 'ريال عماني',
    nameFa: 'ریال عمان',
    category: ItemCategory.CURRENCY,
    displayOrder: 21,
  },
  bhd: {
    name: 'Bahraini Dinar',
    nameAr: 'دينار بحريني',
    nameFa: 'دینار بحرین',
    category: ItemCategory.CURRENCY,
    displayOrder: 22,
  },

  // Crypto
  usdt: {
    name: 'Tether',
    nameAr: 'تيثر',
    nameFa: 'تتر',
    category: ItemCategory.CRYPTO,
    icon: 'SiTether',
    displayOrder: 1,
  },
  btc: {
    name: 'Bitcoin',
    nameAr: 'بيتكوين',
    nameFa: 'بیت‌کوین',
    category: ItemCategory.CRYPTO,
    icon: 'SiBitcoin',
    displayOrder: 2,
  },
  eth: {
    name: 'Ethereum',
    nameAr: 'إيثيريوم',
    nameFa: 'اتریوم',
    category: ItemCategory.CRYPTO,
    icon: 'SiEthereum',
    displayOrder: 3,
  },
  bnb: {
    name: 'Binance Coin',
    nameAr: 'عملة بينانس',
    nameFa: 'بایننس کوین',
    category: ItemCategory.CRYPTO,
    icon: 'SiBinance',
    displayOrder: 4,
  },
  xrp: {
    name: 'XRP (Ripple)',
    nameAr: 'ريبل',
    nameFa: 'ریپل',
    category: ItemCategory.CRYPTO,
    icon: 'SiRipple',
    displayOrder: 5,
  },
  ada: {
    name: 'Cardano',
    nameAr: 'كاردانو',
    nameFa: 'کاردانو',
    category: ItemCategory.CRYPTO,
    displayOrder: 6,
  },
  doge: {
    name: 'Dogecoin',
    nameAr: 'دوجكوين',
    nameFa: 'دوج‌کوین',
    category: ItemCategory.CRYPTO,
    icon: 'SiDogecoin',
    displayOrder: 7,
  },
  sol: {
    name: 'Solana',
    nameAr: 'سولانا',
    nameFa: 'سولانا',
    category: ItemCategory.CRYPTO,
    icon: 'SiSolana',
    displayOrder: 8,
  },
  matic: {
    name: 'Polygon',
    nameAr: 'بوليجون',
    nameFa: 'پالیگان',
    category: ItemCategory.CRYPTO,
    icon: 'SiPolygon',
    displayOrder: 9,
  },
  dot: {
    name: 'Polkadot',
    nameAr: 'بولكادوت',
    nameFa: 'پولکادات',
    category: ItemCategory.CRYPTO,
    icon: 'SiPolkadot',
    displayOrder: 10,
  },
  ltc: {
    name: 'Litecoin',
    nameAr: 'لايتكوين',
    nameFa: 'لایت‌کوین',
    category: ItemCategory.CRYPTO,
    icon: 'SiLitecoin',
    displayOrder: 11,
  },

  // Gold
  sekkeh: {
    name: 'Emami Gold Coin',
    nameAr: 'سکه امامی',
    nameFa: 'سکه امامی',
    category: ItemCategory.GOLD,
    icon: 'FaCoins',
    displayOrder: 1,
  },
  bahar: {
    name: 'Bahar Azadi Coin',
    nameAr: 'سکه بهار آزادی',
    nameFa: 'سکه بهار آزادی',
    category: ItemCategory.GOLD,
    icon: 'FaCoins',
    displayOrder: 2,
  },
  nim: {
    name: 'Half Coin',
    nameAr: 'نیم سکه',
    nameFa: 'نیم سکه',
    category: ItemCategory.GOLD,
    icon: 'FaCoins',
    displayOrder: 3,
  },
  rob: {
    name: 'Quarter Coin',
    nameAr: 'ربع سکه',
    nameFa: 'ربع سکه',
    category: ItemCategory.GOLD,
    icon: 'FaCoins',
    displayOrder: 4,
  },
  gerami: {
    name: '1 Gram Gold Coin',
    nameAr: 'سکه گرمی',
    nameFa: 'سکه گرمی',
    category: ItemCategory.GOLD,
    icon: 'FaCoins',
    displayOrder: 5,
  },
  '18ayar': {
    name: '18K Gold (per gram)',
    nameAr: 'طلای ۱۸ عیار',
    nameFa: 'طلای ۱۸ عیار',
    category: ItemCategory.GOLD,
    icon: 'FaRing',
    displayOrder: 6,
  },
  abshodeh: {
    name: 'Melted Gold',
    nameAr: 'طلای آبشده',
    nameFa: 'طلای آبشده',
    category: ItemCategory.GOLD,
    icon: 'FaFire',
    displayOrder: 7,
  },
};

// Seeding service
class SeedService {
  private readonly logger = new Logger('SeedManagedItems');

  constructor(
    @InjectModel(ManagedItem.name)
    private readonly managedItemModel: Model<ManagedItemDocument>,
  ) {}

  async seed(): Promise<void> {
    this.logger.log('Starting managed_items seed...');

    let created = 0;
    let skipped = 0;
    let updated = 0;

    for (const [code, definition] of Object.entries(ITEM_DEFINITIONS)) {
      try {
        const existing = await this.managedItemModel.findOne({ code }).exec();

        if (existing) {
          // Update existing item
          await this.managedItemModel.updateOne(
            { code },
            {
              $set: {
                name: definition.name,
                nameAr: definition.nameAr,
                nameFa: definition.nameFa,
                category: definition.category,
                parentCode: definition.parentCode,
                variant: definition.variant,
                icon: definition.icon,
                displayOrder: definition.displayOrder,
              },
            },
          );
          updated++;
          this.logger.debug(`Updated: ${code}`);
        } else {
          // Create new item
          const item = new this.managedItemModel({
            code: code.toLowerCase(),
            ohlcCode: code.toUpperCase(),
            name: definition.name,
            nameAr: definition.nameAr,
            nameFa: definition.nameFa,
            category: definition.category,
            parentCode: definition.parentCode,
            variant: definition.variant,
            icon: definition.icon,
            displayOrder: definition.displayOrder,
            source: ItemSource.API,
            hasApiData: true,
            isActive: true,
            isOverridden: false,
          });

          await item.save();
          created++;
          this.logger.debug(`Created: ${code}`);
        }
      } catch (error) {
        this.logger.error(`Failed to process ${code}: ${error instanceof Error ? error.message : String(error)}`);
        skipped++;
      }
    }

    this.logger.log(`Seed complete: ${created} created, ${updated} updated, ${skipped} skipped`);
  }
}

// Bootstrap module for seeding
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: ManagedItem.name, schema: ManagedItemSchema },
    ]),
  ],
  providers: [SeedService],
})
class SeedModule {}

// Main function
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  logger.log('Starting seed script...');

  try {
    const app = await NestFactory.createApplicationContext(SeedModule);
    const seedService = app.get(SeedService);

    await seedService.seed();

    await app.close();
    logger.log('Seed script completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error(`Seed script failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run if executed directly
bootstrap();

// Export for programmatic use
export { ITEM_DEFINITIONS, SeedService, SeedModule };
