import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

/**
 * AED (UAE Dirham) Historical OHLC Data Import Script
 *
 * This script imports historical OHLC data for AED
 */

// Define schemas inline
const HistoricalOhlcSchema = new mongoose.Schema({
  itemCode: { type: String, required: true },
  timeframe: { type: String, required: true, enum: ['hourly', 'daily', 'weekly', 'monthly'] },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  open: { type: Number, required: true },
  high: { type: Number, required: true },
  low: { type: Number, required: true },
  close: { type: Number, required: true },
  dataPoints: { type: Number, default: 0 },
  expiresAt: { type: Date },
}, { timestamps: true, collection: 'historical_ohlc' });

const CurrentPriceSchema = new mongoose.Schema({
  itemCode: { type: String, required: true },
  price: { type: Number, required: true },
  change: { type: Number, default: 0 },
  previousPrice: { type: Number },
  priceTimestamp: { type: Date, required: true },
  source: { type: String },
  rawData: { type: Object },
}, { timestamps: true, collection: 'current_prices' });

// AED Historical Data (from your CSV)
const AED_HISTORICAL_DATA = [
  { open: 309060, low: 307060, high: 309080, close: 307430, gregorian: '2025-11-22', persian: '1404-09-01' },
  { open: 309150, low: 308540, high: 310960, close: 309190, gregorian: '2025-11-20', persian: '1404-08-29' },
  { open: 306930, low: 304450, high: 309060, close: 308920, gregorian: '2025-11-19', persian: '1404-08-28' },
  { open: 306360, low: 305680, high: 307420, close: 306500, gregorian: '2025-11-18', persian: '1404-08-27' },
  { open: 306060, low: 305540, high: 306880, close: 306440, gregorian: '2025-11-17', persian: '1404-08-26' },
  { open: 307600, low: 304750, high: 308260, close: 305490, gregorian: '2025-11-16', persian: '1404-08-25' },
  { open: 305260, low: 305150, high: 309890, close: 307200, gregorian: '2025-11-15', persian: '1404-08-24' },
  { open: 306590, low: 306360, high: 309470, close: 306610, gregorian: '2025-11-13', persian: '1404-08-22' },
  { open: 306430, low: 306220, high: 307290, close: 306630, gregorian: '2025-11-12', persian: '1404-08-21' },
  { open: 293260, low: 293150, high: 299250, close: 299090, gregorian: '2025-11-11', persian: '1404-08-20' },
  { open: 293720, low: 293010, high: 293800, close: 293150, gregorian: '2025-11-10', persian: '1404-08-19' },
  { open: 293440, low: 293420, high: 294080, close: 293700, gregorian: '2025-11-09', persian: '1404-08-18' },
  { open: 293860, low: 292880, high: 294210, close: 293600, gregorian: '2025-11-08', persian: '1404-08-17' },
  { open: 293740, low: 293150, high: 293940, close: 293780, gregorian: '2025-11-06', persian: '1404-08-15' },
  { open: 294690, low: 293560, high: 295030, close: 293720, gregorian: '2025-11-05', persian: '1404-08-14' },
  { open: 293990, low: 293990, high: 295570, close: 294660, gregorian: '2025-11-04', persian: '1404-08-13' },
  { open: 294590, low: 292740, high: 296390, close: 294080, gregorian: '2025-11-03', persian: '1404-08-12' },
  { open: 296010, low: 294670, high: 296410, close: 294890, gregorian: '2025-11-02', persian: '1404-08-11' },
  { open: 292430, low: 292360, high: 296550, close: 296410, gregorian: '2025-11-01', persian: '1404-08-10' },
  { open: 291790, low: 291790, high: 293260, close: 292240, gregorian: '2025-10-30', persian: '1404-08-08' },
  { open: 291150, low: 290450, high: 292710, close: 291090, gregorian: '2025-10-29', persian: '1404-08-07' },
  { open: 293700, low: 291130, high: 317090, close: 291160, gregorian: '2025-10-28', persian: '1404-08-06' },
  { open: 293870, low: 293420, high: 295850, close: 294140, gregorian: '2025-10-27', persian: '1404-08-05' },
  { open: 291040, low: 291000, high: 296010, close: 293600, gregorian: '2025-10-26', persian: '1404-08-04' },
  { open: 291540, low: 290450, high: 293280, close: 291340, gregorian: '2025-10-25', persian: '1404-08-03' },
  { open: 293720, low: 293700, high: 298030, close: 295510, gregorian: '2025-10-23', persian: '1404-08-01' },
  { open: 293640, low: 292060, high: 294080, close: 292790, gregorian: '2025-10-22', persian: '1404-07-30' },
  { open: 289680, low: 288660, high: 297210, close: 296480, gregorian: '2025-10-21', persian: '1404-07-29' },
  { open: 295970, low: 289640, high: 299390, close: 289660, gregorian: '2025-10-20', persian: '1404-07-28' },
  { open: 292290, low: 292200, high: 297210, close: 295060, gregorian: '2025-10-19', persian: '1404-07-27' },
];

async function importHistoricalData() {
  console.log('🚀 Starting AED historical OHLC data import...\n');

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/currency';
  console.log(`🔌 Connecting to MongoDB: ${mongoUri.replace(/\/\/[^@]+@/, '//***:***@')}\n`);

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB\n');

  try {
    // Create models
    const HistoricalOhlc = mongoose.model('HistoricalOhlc', HistoricalOhlcSchema);
    const CurrentPrice = mongoose.model('CurrentPrice', CurrentPriceSchema);

    console.log('📊 Processing AED historical data...\n');

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // Process each data point
    for (const dataPoint of AED_HISTORICAL_DATA) {
      const { open, high, low, close, gregorian } = dataPoint;

      // Convert from Rial to Toman (divide by 10)
      const openToman = open / 10;
      const highToman = high / 10;
      const lowToman = low / 10;
      const closeToman = close / 10;

      // Parse the Gregorian date
      const [year, month, day] = gregorian.split('-').map(Number);
      const periodStart = new Date(year, month - 1, day, 0, 0, 0, 0);
      const periodEnd = new Date(year, month - 1, day, 23, 59, 59, 999);

      // Check if record already exists
      const existing = await HistoricalOhlc.findOne({
        itemCode: 'aed',
        timeframe: 'daily',
        periodStart: periodStart,
      });

      if (existing) {
        console.log(`⏭️  Skipping ${gregorian} - already exists`);
        skippedCount++;
        continue;
      }

      // Create new historical OHLC record
      const historicalRecord = {
        itemCode: 'aed',
        timeframe: 'daily',
        periodStart,
        periodEnd,
        open: openToman,
        high: highToman,
        low: lowToman,
        close: closeToman,
        dataPoints: 1,
      };

      await HistoricalOhlc.create(historicalRecord);
      insertedCount++;
      console.log(`✅ Inserted ${gregorian}: O=${openToman} H=${highToman} L=${lowToman} C=${closeToman}`);
    }

    console.log('\n📈 Updating current price with latest data...\n');

    // Get the most recent data point (first in array since it's sorted newest first)
    const latestData = AED_HISTORICAL_DATA[0];
    const previousData = AED_HISTORICAL_DATA[1];

    // Convert from Rial to Toman
    const latestCloseToman = latestData.close / 10;
    const previousCloseToman = previousData ? previousData.close / 10 : null;

    // Calculate percentage change
    const change = previousCloseToman
      ? ((latestCloseToman - previousCloseToman) / previousCloseToman) * 100
      : 0;

    // Parse the latest Gregorian date
    const [year, month, day] = latestData.gregorian.split('-').map(Number);
    const priceTimestamp = new Date(year, month - 1, day, 12, 0, 0, 0); // Noon

    // Update or create current price
    const currentPriceUpdate = {
      itemCode: 'aed',
      price: latestCloseToman,
      change: parseFloat(change.toFixed(2)),
      previousPrice: previousCloseToman,
      priceTimestamp,
      source: 'manual_import',
      rawData: {
        importDate: new Date().toISOString(),
        dataSource: 'historical_csv',
      },
    };

    const result = await CurrentPrice.findOneAndUpdate(
      { itemCode: 'aed' },
      currentPriceUpdate,
      { upsert: true, new: true },
    );

    if (result) {
      updatedCount++;
      console.log(`✅ Updated current price: ${latestCloseToman} (${change > 0 ? '+' : ''}${change.toFixed(2)}%)\n`);
    }

    // Print summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Import Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Inserted:      ${insertedCount} records`);
    console.log(`⏭️  Skipped:       ${skippedCount} records (already exist)`);
    console.log(`🔄 Current Price: ${updatedCount} updated`);
    console.log(`📅 Date Range:    ${AED_HISTORICAL_DATA[AED_HISTORICAL_DATA.length - 1].gregorian} to ${AED_HISTORICAL_DATA[0].gregorian}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✨ Import completed successfully!\n');
    console.log('You can now:');
    console.log('  • Navigate to yesterday\'s data');
    console.log('  • View 1-week charts (7 data points)');
    console.log('  • View 1-month charts (~30 data points)');
    console.log('\n');

  } catch (error) {
    console.error('❌ Error during import:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the import
importHistoricalData()
  .then(() => {
    console.log('🎉 Script finished!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
