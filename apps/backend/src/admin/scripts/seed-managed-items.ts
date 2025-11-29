/**
 * Seed script for managed_items collection
 *
 * This script populates the managed_items collection with initial data
 * based on Persian API items (from 3 endpoints: common, gold-currency-coin, digitalcurrency)
 *
 * NOTE: Manual variants (e.g., usd_turkey, usd_dubai) are added via admin panel,
 * not in this seed script. This only contains items that come from Persian API.
 *
 * Run with: npx ts-node -r tsconfig-paths/register src/admin/scripts/seed-managed-items.ts
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
} from '../../schemas/managed-item.schema';

/**
 * Item definitions matching Persian API data
 * These are the BASE items from the API - variants are added manually via admin panel
 */
const ITEM_DEFINITIONS: Record<string, {
  name: string;
  nameAr?: string;
  nameFa?: string;
  category: ItemCategory;
  parentCode?: string;
  icon?: string;
  displayOrder: number;
  apiKey?: string; // Persian API key for reference
}> = {
  // ==================== CURRENCIES (ارز آزاد - Free Market) ====================
  usd: {
    name: 'US Dollar',
    nameAr: 'دولار أمريكي',
    nameFa: 'دلار',
    category: ItemCategory.CURRENCIES,
    parentCode: 'usd',
    icon: 'FaDollarSign',
    displayOrder: 1,
    apiKey: '137202',
  },
  eur: {
    name: 'Euro',
    nameAr: 'يورو',
    nameFa: 'یورو',
    category: ItemCategory.CURRENCIES,
    parentCode: 'eur',
    icon: 'FaEuroSign',
    displayOrder: 2,
    apiKey: '137204',
  },
  aed: {
    name: 'UAE Dirham',
    nameAr: 'درهم إماراتي',
    nameFa: 'درهم امارات',
    category: ItemCategory.CURRENCIES,
    parentCode: 'aed',
    displayOrder: 3,
    apiKey: '137205',
  },
  gbp: {
    name: 'British Pound',
    nameAr: 'جنيه استرليني',
    nameFa: 'پوند انگلیس',
    category: ItemCategory.CURRENCIES,
    parentCode: 'gbp',
    icon: 'FaPoundSign',
    displayOrder: 4,
    apiKey: '137206',
  },
  rub: {
    name: 'Russian Ruble',
    nameAr: 'روبل روسي',
    nameFa: 'روبل روسیه',
    category: ItemCategory.CURRENCIES,
    parentCode: 'rub',
    icon: 'FaRubleSign',
    displayOrder: 5,
    apiKey: '137213',
  },

  // ==================== CURRENCIES (ارز دولتی - Official) ====================
  usd_official: {
    name: 'US Dollar (Official)',
    nameAr: 'دولار أمريكي (رسمي)',
    nameFa: 'دلار (بانکی)',
    category: ItemCategory.CURRENCIES,
    parentCode: 'usd',
    displayOrder: 10,
    apiKey: '137252',
  },
  eur_official: {
    name: 'Euro (Official)',
    nameAr: 'يورو (رسمي)',
    nameFa: 'یورو (بانکی)',
    category: ItemCategory.CURRENCIES,
    parentCode: 'eur',
    displayOrder: 11,
    apiKey: '137253',
  },
  gbp_official: {
    name: 'British Pound (Official)',
    nameAr: 'جنيه (رسمي)',
    nameFa: 'پوند (بانکی)',
    category: ItemCategory.CURRENCIES,
    parentCode: 'gbp',
    displayOrder: 12,
    apiKey: '137255',
  },
  aed_official: {
    name: 'UAE Dirham (Official)',
    nameAr: 'درهم (رسمي)',
    nameFa: 'درهم امارات (بانکی)',
    category: ItemCategory.CURRENCIES,
    parentCode: 'aed',
    displayOrder: 13,
    apiKey: '790758',
  },

  // ==================== CURRENCIES (سنا - SANA Buy) ====================
  usd_sana_buy: {
    name: 'US Dollar (SANA Buy)',
    nameAr: 'دولار (سنا/شراء)',
    nameFa: 'دلار (سنا/خرید)',
    category: ItemCategory.CURRENCIES,
    parentCode: 'usd',
    displayOrder: 20,
    apiKey: '137291',
  },
  eur_sana_buy: {
    name: 'Euro (SANA Buy)',
    nameAr: 'يورو (سنا/شراء)',
    nameFa: 'یورو (سنا/خرید)',
    category: ItemCategory.CURRENCIES,
    parentCode: 'eur',
    displayOrder: 21,
    apiKey: '137292',
  },
  aed_sana_buy: {
    name: 'UAE Dirham (SANA Buy)',
    nameAr: 'درهم (سنا/شراء)',
    nameFa: 'درهم (سنا/خرید)',
    category: ItemCategory.CURRENCIES,
    parentCode: 'aed',
    displayOrder: 22,
    apiKey: '137293',
  },
  gbp_sana_buy: {
    name: 'British Pound (SANA Buy)',
    nameAr: 'جنيه (سنا/شراء)',
    nameFa: 'پوند (سنا/خرید)',
    category: ItemCategory.CURRENCIES,
    parentCode: 'gbp',
    displayOrder: 23,
    apiKey: '137294',
  },

  // ==================== CURRENCIES (سنا - SANA Sell) ====================
  usd_sana_sell: {
    name: 'US Dollar (SANA Sell)',
    nameAr: 'دولار (سنا/بيع)',
    nameFa: 'دلار (سنا/فروش)',
    category: ItemCategory.CURRENCIES,
    parentCode: 'usd',
    displayOrder: 30,
    apiKey: '137307',
  },
  eur_sana_sell: {
    name: 'Euro (SANA Sell)',
    nameAr: 'يورو (سنا/بيع)',
    nameFa: 'یورو (سنا/فروش)',
    category: ItemCategory.CURRENCIES,
    parentCode: 'eur',
    displayOrder: 31,
    apiKey: '137308',
  },
  aed_sana_sell: {
    name: 'UAE Dirham (SANA Sell)',
    nameAr: 'درهم (سنا/بيع)',
    nameFa: 'درهم (سنا/فروش)',
    category: ItemCategory.CURRENCIES,
    parentCode: 'aed',
    displayOrder: 32,
    apiKey: '137309',
  },
  gbp_sana_sell: {
    name: 'British Pound (SANA Sell)',
    nameAr: 'جنيه (سنا/بيع)',
    nameFa: 'پوند (سنا/فروش)',
    category: ItemCategory.CURRENCIES,
    parentCode: 'gbp',
    displayOrder: 33,
    apiKey: '137310',
  },

  // ==================== CURRENCIES (نیما - NIMA) ====================
  usd_nima: {
    name: 'US Dollar (NIMA)',
    nameAr: 'دولار (نيما)',
    nameFa: 'دلار (نیما/فروش)',
    category: ItemCategory.CURRENCIES,
    parentCode: 'usd',
    displayOrder: 40,
    apiKey: '523800',
  },
  eur_nima: {
    name: 'Euro (NIMA)',
    nameAr: 'يورو (نيما)',
    nameFa: 'یورو (نیما/فروش)',
    category: ItemCategory.CURRENCIES,
    parentCode: 'eur',
    displayOrder: 41,
    apiKey: '523764',
  },
  aed_nima: {
    name: 'UAE Dirham (NIMA)',
    nameAr: 'درهم (نيما)',
    nameFa: 'درهم امارات (نیما/فروش)',
    category: ItemCategory.CURRENCIES,
    parentCode: 'aed',
    displayOrder: 42,
    apiKey: '523802',
  },
  gbp_nima: {
    name: 'British Pound (NIMA)',
    nameAr: 'جنيه (نيما)',
    nameFa: 'پوند انگلیس (نیما/فروش)',
    category: ItemCategory.CURRENCIES,
    parentCode: 'gbp',
    displayOrder: 43,
    apiKey: '523804',
  },

  // ==================== GOLD ====================
  gold_18k: {
    name: '18K Gold (750)',
    nameAr: 'ذهب 18 قيراط',
    nameFa: 'طلای 18 عیار / 750',
    category: ItemCategory.GOLD,
    icon: 'FaRing',
    displayOrder: 1,
    apiKey: '137120',
  },
  gold_18k_740: {
    name: '18K Gold (740)',
    nameAr: 'ذهب 18 قيراط (740)',
    nameFa: 'طلای 18 عیار / 740',
    category: ItemCategory.GOLD,
    icon: 'FaRing',
    displayOrder: 2,
    apiKey: '391295',
  },
  gold_24k: {
    name: '24K Gold',
    nameAr: 'ذهب 24 قيراط',
    nameFa: 'طلای ۲۴ عیار',
    category: ItemCategory.GOLD,
    icon: 'FaRing',
    displayOrder: 3,
    apiKey: '137121',
  },
  gold_used: {
    name: 'Used Gold',
    nameAr: 'ذهب مستعمل',
    nameFa: 'طلای دست دوم',
    category: ItemCategory.GOLD,
    icon: 'FaRing',
    displayOrder: 4,
    apiKey: '391298',
  },
  ounce_gold: {
    name: 'Gold Ounce',
    nameAr: 'أونصة الذهب',
    nameFa: 'انس طلا',
    category: ItemCategory.GOLD,
    displayOrder: 5,
    apiKey: '137118',
  },
  ounce_silver: {
    name: 'Silver Ounce',
    nameAr: 'أونصة الفضة',
    nameFa: 'انس نقره',
    category: ItemCategory.GOLD,
    displayOrder: 6,
    apiKey: '137122',
  },
  ounce_platinum: {
    name: 'Platinum Ounce',
    nameAr: 'أونصة البلاتين',
    nameFa: 'انس پلاتین',
    category: ItemCategory.GOLD,
    displayOrder: 7,
    apiKey: '137131',
  },
  ounce_palladium: {
    name: 'Palladium Ounce',
    nameAr: 'أونصة البلاديوم',
    nameFa: 'انس پالادیوم',
    category: ItemCategory.GOLD,
    displayOrder: 8,
    apiKey: '137132',
  },
  silver_gram: {
    name: 'Silver Gram (999)',
    nameAr: 'غرام فضة 999',
    nameFa: 'گرم نقره ۹۹۹',
    category: ItemCategory.GOLD,
    displayOrder: 9,
    apiKey: '684758',
  },
  silver_999: {
    name: 'Silver 999',
    nameAr: 'فضة 999',
    nameFa: 'نقره ۹۹۹',
    category: ItemCategory.GOLD,
    displayOrder: 10,
    apiKey: '926813',
  },

  // ==================== COINS (سکه) ====================
  sekkeh: {
    name: 'Emami Gold Coin',
    nameAr: 'سکه امامی',
    nameFa: 'سکه امامی',
    category: ItemCategory.GOLD,
    icon: 'FaCoins',
    displayOrder: 20,
    apiKey: '137137',
  },
  bahar: {
    name: 'Bahar Azadi Coin',
    nameAr: 'سکه بهار آزادی',
    nameFa: 'سکه بهار آزادی',
    category: ItemCategory.GOLD,
    icon: 'FaCoins',
    displayOrder: 21,
    apiKey: '137136',
  },
  nim: {
    name: 'Half Coin',
    nameAr: 'نیم سکه',
    nameFa: 'نیم سکه',
    category: ItemCategory.GOLD,
    icon: 'FaCoins',
    displayOrder: 22,
    apiKey: '137138',
  },
  rob: {
    name: 'Quarter Coin',
    nameAr: 'ربع سکه',
    nameFa: 'ربع سکه',
    category: ItemCategory.GOLD,
    icon: 'FaCoins',
    displayOrder: 23,
    apiKey: '137139',
  },
  gerami: {
    name: '1 Gram Gold Coin',
    nameAr: 'سکه گرمی',
    nameFa: 'سکه گرمی',
    category: ItemCategory.GOLD,
    icon: 'FaCoins',
    displayOrder: 24,
    apiKey: '137140',
  },
  mesghal: {
    name: 'Mesghal Gold',
    nameAr: 'مثقال طلا',
    nameFa: 'مثقال طلا',
    category: ItemCategory.GOLD,
    displayOrder: 25,
    apiKey: '137119',
  },
  mesghal_coin: {
    name: 'Mesghal (Coin Based)',
    nameAr: 'مثقال / بر مبنای سکه',
    nameFa: 'مثقال / بر مبنای سکه',
    category: ItemCategory.GOLD,
    displayOrder: 26,
    apiKey: '391614',
  },
  abshodeh: {
    name: 'Melted Gold (Cash)',
    nameAr: 'آبشده نقدی',
    nameFa: 'آبشده نقدی',
    category: ItemCategory.GOLD,
    icon: 'FaFire',
    displayOrder: 27,
    apiKey: '391296',
  },
  abshodeh_bank: {
    name: 'Melted Gold (Bank)',
    nameAr: 'آبشده بنکداری',
    nameFa: 'آبشده بنکداری',
    category: ItemCategory.GOLD,
    displayOrder: 28,
    apiKey: '137146',
  },
  abshodeh_small: {
    name: 'Melted Gold (Small)',
    nameAr: 'آبشده کمتر از کیلو',
    nameFa: 'آبشده کمتر از کیلو',
    category: ItemCategory.GOLD,
    displayOrder: 29,
    apiKey: '391297',
  },

  // ==================== CRYPTO ====================
  btc: {
    name: 'Bitcoin',
    nameAr: 'بيتكوين',
    nameFa: 'بیت‌کوین',
    category: ItemCategory.CRYPTO,
    icon: 'SiBitcoin',
    displayOrder: 1,
  },
  eth: {
    name: 'Ethereum',
    nameAr: 'إيثيريوم',
    nameFa: 'اتریوم',
    category: ItemCategory.CRYPTO,
    icon: 'SiEthereum',
    displayOrder: 2,
  },
  usdt: {
    name: 'Tether',
    nameAr: 'تيثر',
    nameFa: 'تتر',
    category: ItemCategory.CRYPTO,
    icon: 'SiTether',
    displayOrder: 3,
  },
  xrp: {
    name: 'XRP',
    nameAr: 'ريبل',
    nameFa: 'ریپل',
    category: ItemCategory.CRYPTO,
    displayOrder: 4,
  },
  bnb: {
    name: 'BNB',
    nameAr: 'عملة بينانس',
    nameFa: 'بایننس',
    category: ItemCategory.CRYPTO,
    icon: 'SiBinance',
    displayOrder: 5,
  },
  sol: {
    name: 'Solana',
    nameAr: 'سولانا',
    nameFa: 'سولانا',
    category: ItemCategory.CRYPTO,
    icon: 'SiSolana',
    displayOrder: 6,
  },
  usdc: {
    name: 'USDC',
    nameAr: 'يو إس دي سي',
    nameFa: 'یو‌اس‌دی‌سی',
    category: ItemCategory.CRYPTO,
    displayOrder: 7,
  },
  trx: {
    name: 'TRON',
    nameAr: 'ترون',
    nameFa: 'ترون',
    category: ItemCategory.CRYPTO,
    displayOrder: 8,
  },
  doge: {
    name: 'Dogecoin',
    nameAr: 'دوجكوين',
    nameFa: 'دوج‌کوین',
    category: ItemCategory.CRYPTO,
    icon: 'SiDogecoin',
    displayOrder: 9,
  },
  ada: {
    name: 'Cardano',
    nameAr: 'كاردانو',
    nameFa: 'کاردانو',
    category: ItemCategory.CRYPTO,
    displayOrder: 10,
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
    this.logger.log(`Total items in seed: ${Object.keys(ITEM_DEFINITIONS).length}`);
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
