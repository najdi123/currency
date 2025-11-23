import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

/**
 * Simple Historical OHLC Data Import Script
 *
 * This script directly connects to MongoDB and imports historical OHLC data
 * without loading the full NestJS application.
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

// USD Historical Data (from your CSV)
const USD_HISTORICAL_DATA = [
  { open: 1135100, low: 1127800, high: 1135200, close: 1129100, gregorian: '2025-11-22', persian: '1404-09-01' },
  { open: 1134750, low: 1132800, high: 1141500, close: 1135200, gregorian: '2025-11-20', persian: '1404-08-29' },
  { open: 1126700, low: 1117600, high: 1134500, close: 1133600, gregorian: '2025-11-19', persian: '1404-08-28' },
  { open: 1124900, low: 1122100, high: 1128500, close: 1125500, gregorian: '2025-11-18', persian: '1404-08-27' },
  { open: 1123200, low: 1121600, high: 1126500, close: 1124950, gregorian: '2025-11-17', persian: '1404-08-26' },
  { open: 1130200, low: 1119300, high: 1132200, close: 1121900, gregorian: '2025-11-16', persian: '1404-08-25' },
  { open: 1121000, low: 1120800, high: 1138200, close: 1128300, gregorian: '2025-11-15', persian: '1404-08-24' },
  { open: 1125400, low: 1124800, high: 1136200, close: 1125300, gregorian: '2025-11-13', persian: '1404-08-22' },
  { open: 1102100, low: 1101800, high: 1128200, close: 1126100, gregorian: '2025-11-12', persian: '1404-08-21' },
  { open: 1076400, low: 1076300, high: 1098700, close: 1098400, gregorian: '2025-11-11', persian: '1404-08-20' },
  { open: 1078500, low: 1075800, high: 1078700, close: 1076700, gregorian: '2025-11-10', persian: '1404-08-19' },
  { open: 1077450, low: 1077300, high: 1079700, close: 1078600, gregorian: '2025-11-09', persian: '1404-08-18' },
  { open: 1079200, low: 1075300, high: 1080200, close: 1078050, gregorian: '2025-11-08', persian: '1404-08-17' },
  { open: 1078700, low: 1076300, high: 1079200, close: 1078400, gregorian: '2025-11-06', persian: '1404-08-15' },
  { open: 1082100, low: 1077800, high: 1083200, close: 1078600, gregorian: '2025-11-05', persian: '1404-08-14' },
  { open: 1079300, low: 1079300, high: 1085200, close: 1082150, gregorian: '2025-11-04', persian: '1404-08-13' },
  { open: 1087850, low: 1074800, high: 1088200, close: 1079700, gregorian: '2025-11-03', persian: '1404-08-12' },
  { open: 1087200, low: 1082300, high: 1088700, close: 1083200, gregorian: '2025-11-02', persian: '1404-08-11' },
  { open: 1073800, low: 1073800, high: 1089200, close: 1088700, gregorian: '2025-11-01', persian: '1404-08-10' },
  { open: 1071300, low: 1071300, high: 1076700, close: 1073000, gregorian: '2025-10-30', persian: '1404-08-08' },
  { open: 1069050, low: 1066800, high: 1074700, close: 1069100, gregorian: '2025-10-29', persian: '1404-08-07' },
  { open: 1078550, low: 1069300, high: 1083200, close: 1069300, gregorian: '2025-10-28', persian: '1404-08-06' },
  { open: 1079150, low: 1077300, high: 1086200, close: 1079800, gregorian: '2025-10-27', persian: '1404-08-05' },
  { open: 1068850, low: 1068800, high: 1087200, close: 1078400, gregorian: '2025-10-26', persian: '1404-08-04' },
  { open: 1071200, low: 1066800, high: 1077200, close: 1070200, gregorian: '2025-10-25', persian: '1404-08-03' },
  { open: 1078450, low: 1078300, high: 1094200, close: 1084800, gregorian: '2025-10-23', persian: '1404-08-01' },
  { open: 1078200, low: 1072300, high: 1079700, close: 1075600, gregorian: '2025-10-22', persian: '1404-07-30' },
  { open: 1063600, low: 1059800, high: 1091200, close: 1088900, gregorian: '2025-10-21', persian: '1404-07-29' },
  { open: 1086600, low: 1063800, high: 1099200, close: 1064100, gregorian: '2025-10-20', persian: '1404-07-28' },
  { open: 1073050, low: 1072800, high: 1091200, close: 1083400, gregorian: '2025-10-19', persian: '1404-07-27' },
];

async function importHistoricalData() {
  console.log('🚀 Starting historical OHLC data import...\n');

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/currency';
  console.log(`🔌 Connecting to MongoDB: ${mongoUri.replace(/\/\/[^@]+@/, '//***:***@')}\n`);

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB\n');

  try {
    // Create models
    const HistoricalOhlc = mongoose.model('HistoricalOhlc', HistoricalOhlcSchema);
    const CurrentPrice = mongoose.model('CurrentPrice', CurrentPriceSchema);

    console.log('📊 Processing USD historical data...\n');

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // Process each data point
    for (const dataPoint of USD_HISTORICAL_DATA) {
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
        itemCode: 'usd_sell',
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
        itemCode: 'usd_sell',
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
    const latestData = USD_HISTORICAL_DATA[0];
    const previousData = USD_HISTORICAL_DATA[1];

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
      itemCode: 'usd_sell',
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
      { itemCode: 'usd_sell' },
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
    console.log(`📅 Date Range:    ${USD_HISTORICAL_DATA[USD_HISTORICAL_DATA.length - 1].gregorian} to ${USD_HISTORICAL_DATA[0].gregorian}`);
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
