import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

/**
 * Cleanup Historical Data Script
 *
 * This script removes existing historical OHLC data for USD, EUR, and AED
 * so it can be re-imported with correct Toman values.
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

async function cleanupHistoricalData() {
  console.log('🧹 Starting historical data cleanup...\n');

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/currency';
  console.log(`🔌 Connecting to MongoDB: ${mongoUri.replace(/\/\/[^@]+@/, '//***:***@')}\n`);

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB\n');

  try {
    // Create models
    const HistoricalOhlc = mongoose.model('HistoricalOhlc', HistoricalOhlcSchema);
    const CurrentPrice = mongoose.model('CurrentPrice', CurrentPriceSchema);

    const itemCodes = ['usd_sell', 'eur', 'aed'];

    console.log('🗑️  Deleting historical OHLC data...\n');

    let totalDeleted = 0;

    for (const itemCode of itemCodes) {
      // Delete historical OHLC records
      const result = await HistoricalOhlc.deleteMany({
        itemCode: itemCode,
        timeframe: 'daily',
      });

      console.log(`  ✅ Deleted ${result.deletedCount} historical records for ${itemCode}`);
      totalDeleted += result.deletedCount;
    }

    console.log(`\n✨ Total deleted: ${totalDeleted} historical OHLC records\n`);

    // Print summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Cleanup Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🗑️  Total Deleted: ${totalDeleted} records`);
    console.log(`📋 Items Cleaned:  ${itemCodes.join(', ')}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✨ Cleanup completed successfully!\n');
    console.log('You can now run the import scripts to re-import data with correct Toman values:\n');
    console.log('  • npm run script:import-usd');
    console.log('  • npm run script:import-euro');
    console.log('  • npm run script:import-aed\n');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupHistoricalData()
  .then(() => {
    console.log('🎉 Script finished!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
