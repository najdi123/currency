import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

/**
 * Euro Historical OHLC Data Import Script
 *
 * This script imports historical OHLC data for EUR
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

// EUR Historical Data (from your CSV)
const EUR_HISTORICAL_DATA = [
  { open: 1306900, low: 1298700, high: 1307200, close: 1300200, gregorian: '2025-11-22', persian: '1404-09-01' },
  { open: 1307500, low: 1304800, high: 1315400, close: 1307100, gregorian: '2025-11-20', persian: '1404-08-29' },
  { open: 1306000, low: 1295400, high: 1313100, close: 1308500, gregorian: '2025-11-19', persian: '1404-08-28' },
  { open: 1304400, low: 1301600, high: 1307500, close: 1302600, gregorian: '2025-11-18', persian: '1404-08-27' },
  { open: 1304800, low: 1301800, high: 1308400, close: 1305000, gregorian: '2025-11-17', persian: '1404-08-26' },
  { open: 1313200, low: 1301000, high: 1316000, close: 1304200, gregorian: '2025-11-16', persian: '1404-08-25' },
  { open: 1303200, low: 1302700, high: 1322900, close: 1311400, gregorian: '2025-11-15', persian: '1404-08-24' },
  { open: 1304700, low: 1304400, high: 1320300, close: 1307700, gregorian: '2025-11-13', persian: '1404-08-22' },
  { open: 1272400, low: 1271600, high: 1307400, close: 1305000, gregorian: '2025-11-12', persian: '1404-08-21' },
  { open: 1244300, low: 1243800, high: 1274800, close: 1273000, gregorian: '2025-11-11', persian: '1404-08-20' },
  { open: 1246400, low: 1242700, high: 1249000, close: 1243700, gregorian: '2025-11-10', persian: '1404-08-19' },
  { open: 1246100, low: 1246000, high: 1248800, close: 1247200, gregorian: '2025-11-09', persian: '1404-08-18' },
  { open: 1247900, low: 1243700, high: 1249400, close: 1246800, gregorian: '2025-11-08', persian: '1404-08-17' },
  { open: 1241600, low: 1238500, high: 1244400, close: 1243900, gregorian: '2025-11-06', persian: '1404-08-15' },
  { open: 1242700, low: 1237000, high: 1244600, close: 1238100, gregorian: '2025-11-05', persian: '1404-08-14' },
  { open: 1244400, low: 1242800, high: 1251000, close: 1243400, gregorian: '2025-11-04', persian: '1404-08-13' },
  { open: 1247800, low: 1239000, high: 1255900, close: 1244800, gregorian: '2025-11-03', persian: '1404-08-12' },
  { open: 1254300, low: 1248700, high: 1256000, close: 1249600, gregorian: '2025-11-02', persian: '1404-08-11' },
  { open: 1239100, low: 1238800, high: 1256600, close: 1256000, gregorian: '2025-11-01', persian: '1404-08-10' },
  { open: 1244400, low: 1239600, high: 1250600, close: 1241200, gregorian: '2025-10-30', persian: '1404-08-08' },
  { open: 1243900, low: 1242300, high: 1250500, close: 1247100, gregorian: '2025-10-29', persian: '1404-08-07' },
  { open: 1257000, low: 1246600, high: 1357700, close: 1247000, gregorian: '2025-10-28', persian: '1404-08-06' },
  { open: 1254200, low: 1253800, high: 1262300, close: 1256800, gregorian: '2025-10-27', persian: '1404-08-05' },
  { open: 1242900, low: 1242700, high: 1264100, close: 1253800, gregorian: '2025-10-26', persian: '1404-08-04' },
  { open: 1245000, low: 1240400, high: 1252500, close: 1244100, gregorian: '2025-10-25', persian: '1404-08-03' },
  { open: 1250700, low: 1250400, high: 1269300, close: 1259000, gregorian: '2025-10-23', persian: '1404-08-01' },
  { open: 1250800, low: 1243400, high: 1252100, close: 1249200, gregorian: '2025-10-22', persian: '1404-07-30' },
  { open: 1237100, low: 1232400, high: 1267600, close: 1265000, gregorian: '2025-10-21', persian: '1404-07-29' },
  { open: 1267500, low: 1239600, high: 1282300, close: 1239900, gregorian: '2025-10-20', persian: '1404-07-28' },
  { open: 1250400, low: 1250000, high: 1271500, close: 1262300, gregorian: '2025-10-19', persian: '1404-07-27' },
];

async function importHistoricalData() {
  console.log('🚀 Starting EUR historical OHLC data import...\n');

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/currency';
  console.log(`🔌 Connecting to MongoDB: ${mongoUri.replace(/\/\/[^@]+@/, '//***:***@')}\n`);

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB\n');

  try {
    // Create models
    const HistoricalOhlc = mongoose.model('HistoricalOhlc', HistoricalOhlcSchema);
    const CurrentPrice = mongoose.model('CurrentPrice', CurrentPriceSchema);

    console.log('📊 Processing EUR historical data...\n');

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // Process each data point
    for (const dataPoint of EUR_HISTORICAL_DATA) {
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
        itemCode: 'eur',
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
        itemCode: 'eur',
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
    const latestData = EUR_HISTORICAL_DATA[0];
    const previousData = EUR_HISTORICAL_DATA[1];

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
      itemCode: 'eur',
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
      { itemCode: 'eur' },
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
    console.log(`📅 Date Range:    ${EUR_HISTORICAL_DATA[EUR_HISTORICAL_DATA.length - 1].gregorian} to ${EUR_HISTORICAL_DATA[0].gregorian}`);
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
