import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

/**
 * 18 Karat Gold Historical OHLC Data Import Script
 *
 * This script imports historical OHLC data for 18 Karat Gold (18ayar)
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

// 18 Karat Gold Historical Data
const GOLD_18K_HISTORICAL_DATA = [
  { open: 113489000, low: 111178000, high: 113489000, close: 111252000, gregorian: '2025-11-22', persian: '1404-09-01' },
  { open: 113477000, low: 112836000, high: 114625000, close: 113494000, gregorian: '2025-11-20', persian: '1404-08-29' },
  { open: 111273000, low: 111273000, high: 114290000, close: 113459000, gregorian: '2025-11-19', persian: '1404-08-28' },
  { open: 111827000, low: 109814000, high: 111827000, close: 111287000, gregorian: '2025-11-18', persian: '1404-08-27' },
  { open: 111049000, low: 111049000, high: 112132000, close: 111829000, gregorian: '2025-11-17', persian: '1404-08-26' },
  { open: 112265000, low: 110576000, high: 112755000, close: 111070000, gregorian: '2025-11-16', persian: '1404-08-25' },
  { open: 115560000, low: 111986000, high: 115560000, close: 112259000, gregorian: '2025-11-15', persian: '1404-08-24' },
  { open: 113976000, low: 113976000, high: 116633000, close: 115583000, gregorian: '2025-11-13', persian: '1404-08-22' },
  { open: 112426990, low: 112311560, high: 114299000, close: 113972000, gregorian: '2025-11-12', persian: '1404-08-21' },
  { open: 105679000, low: 105679000, high: 111252000, close: 110081000, gregorian: '2025-11-11', persian: '1404-08-20' },
  { open: 104568000, low: 104568000, high: 105875000, close: 105711000, gregorian: '2025-11-10', persian: '1404-08-19' },
  { open: 104303000, low: 104303000, high: 104882000, close: 104550000, gregorian: '2025-11-09', persian: '1404-08-18' },
  { open: 105039000, low: 104132000, high: 105039000, close: 104307000, gregorian: '2025-11-08', persian: '1404-08-17' },
  { open: 104718000, low: 104718000, high: 105203000, close: 105019000, gregorian: '2025-11-06', persian: '1404-08-15' },
  { open: 105039000, low: 104317000, high: 105252000, close: 104686000, gregorian: '2025-11-05', persian: '1404-08-14' },
  { open: 104573000, low: 104340000, high: 105757000, close: 104728000, gregorian: '2025-11-04', persian: '1404-08-13' },
  { open: 104855000, low: 104640000, high: 105319000, close: 104885000, gregorian: '2025-11-03', persian: '1404-08-12' },
  { open: 106291000, low: 104709000, high: 106697000, close: 104970000, gregorian: '2025-11-02', persian: '1404-08-11' },
  { open: 103816000, low: 103816000, high: 106614000, close: 106263000, gregorian: '2025-11-01', persian: '1404-08-10' },
  { open: 104575000, low: 103486000, high: 104605000, close: 103818000, gregorian: '2025-10-30', persian: '1404-08-08' },
  { open: 103509000, low: 103509000, high: 105621000, close: 104550000, gregorian: '2025-10-29', persian: '1404-08-07' },
  { open: 105457000, low: 102516000, high: 105457000, close: 103527000, gregorian: '2025-10-28', persian: '1404-08-06' },
  { open: 107452000, low: 105171000, high: 107874000, close: 105453000, gregorian: '2025-10-27', persian: '1404-08-05' },
  { open: 106471000, low: 106471000, high: 109218000, close: 107438000, gregorian: '2025-10-26', persian: '1404-08-04' },
  { open: 108934000, low: 105702000, high: 108934000, close: 106494000, gregorian: '2025-10-25', persian: '1404-08-03' },
  { open: 108613000, low: 108613000, high: 109754000, close: 108953000, gregorian: '2025-10-23', persian: '1404-08-01' },
  { open: 109149000, low: 107987000, high: 110098000, close: 108639000, gregorian: '2025-10-22', persian: '1404-07-30' },
  { open: 109733000, low: 109096000, high: 111991000, close: 109121000, gregorian: '2025-10-21', persian: '1404-07-29' },
  { open: 110834000, low: 108322000, high: 110834000, close: 109742000, gregorian: '2025-10-20', persian: '1404-07-28' },
  { open: 108465000, low: 108465000, high: 112582000, close: 110818000, gregorian: '2025-10-19', persian: '1404-07-27' },
  // Additional older data
  { open: 112734000, low: 107537000, high: 112734000, close: 108477000, gregorian: '2025-10-18', persian: '1404-07-26' },
  { open: 111698000, low: 111698000, high: 113505000, close: 112741000, gregorian: '2025-10-16', persian: '1404-07-24' },
  { open: 108445000, low: 108445000, high: 111889000, close: 111700000, gregorian: '2025-10-15', persian: '1404-07-23' },
  { open: 109347000, low: 107953000, high: 109811000, close: 108433000, gregorian: '2025-10-14', persian: '1404-07-22' },
  { open: 108440000, low: 108440000, high: 111171000, close: 109345000, gregorian: '2025-10-13', persian: '1404-07-21' },
  { open: 109200000, low: 106937000, high: 109973000, close: 108424000, gregorian: '2025-10-12', persian: '1404-07-20' },
  { open: 111414000, low: 109086000, high: 111866000, close: 109227000, gregorian: '2025-10-11', persian: '1404-07-19' },
  { open: 113711000, low: 110195000, high: 113711000, close: 111427000, gregorian: '2025-10-09', persian: '1404-07-17' },
  { open: 109303000, low: 109303000, high: 114660000, close: 113729000, gregorian: '2025-10-08', persian: '1404-07-16' },
  { open: 105303000, low: 105303000, high: 110065000, close: 109299000, gregorian: '2025-10-07', persian: '1404-07-15' },
  { open: 106039000, low: 105139000, high: 107064000, close: 105309000, gregorian: '2025-10-06', persian: '1404-07-14' },
  { open: 109544000, low: 105623000, high: 109544000, close: 106041000, gregorian: '2025-10-05', persian: '1404-07-13' },
  { open: 110827000, low: 108899000, high: 110943000, close: 109548000, gregorian: '2025-10-04', persian: '1404-07-12' },
  { open: 109049000, low: 109049000, high: 111658000, close: 110813000, gregorian: '2025-10-02', persian: '1404-07-10' },
  { open: 106909000, low: 106734000, high: 109234000, close: 109066000, gregorian: '2025-10-01', persian: '1404-07-09' },
  { open: 104615000, low: 104374000, high: 107318000, close: 106741000, gregorian: '2025-09-30', persian: '1404-07-08' },
  { open: 101606000, low: 101122000, high: 105146000, close: 104603000, gregorian: '2025-09-29', persian: '1404-07-07' },
  { open: 103564000, low: 100496000, high: 103564000, close: 101595000, gregorian: '2025-09-28', persian: '1404-07-06' },
  { open: 100000000, low: 100000000, high: 103578000, close: 103571000, gregorian: '2025-09-27', persian: '1404-07-05' },
  { open: 99462000, low: 100000000, high: 99997000, close: 99757000, gregorian: '2025-09-25', persian: '1404-07-03' },
  { open: 96497000, low: 100000000, high: 99997000, close: 99482000, gregorian: '2025-09-24', persian: '1404-07-02' },
  { open: 93588000, low: 92670000, high: 96860000, close: 96511000, gregorian: '2025-09-23', persian: '1404-07-01' },
  { open: 96744000, low: 93263000, high: 96814000, close: 93605000, gregorian: '2025-09-22', persian: '1404-06-31' },
  { open: 92349000, low: 92349000, high: 96975000, close: 96742000, gregorian: '2025-09-21', persian: '1404-06-30' },
  { open: 87417000, low: 87417000, high: 93581000, close: 92356000, gregorian: '2025-09-20', persian: '1404-06-29' },
  { open: 88433000, low: 87337000, high: 88433000, close: 87410000, gregorian: '2025-09-18', persian: '1404-06-27' },
  { open: 88449000, low: 88191000, high: 89241000, close: 88399000, gregorian: '2025-09-17', persian: '1404-06-26' },
  { open: 86789000, low: 86789000, high: 89218000, close: 88415000, gregorian: '2025-09-16', persian: '1404-06-25' },
  { open: 84245000, low: 84245000, high: 86863000, close: 86803000, gregorian: '2025-09-15', persian: '1404-06-24' },
  { open: 84605000, low: 83887000, high: 85822000, close: 84254000, gregorian: '2025-09-14', persian: '1404-06-23' },
  // Additional older data (September - June)
  { open: 86475000, low: 84497000, high: 86475000, close: 84624000, gregorian: '2025-09-13', persian: '1404-06-22' },
  { open: 88523000, low: 86069000, high: 88523000, close: 86342000, gregorian: '2025-09-11', persian: '1404-06-20' },
  { open: 88059000, low: 87316000, high: 88664000, close: 88502000, gregorian: '2025-09-09', persian: '1404-06-18' },
  { open: 88188000, low: 87983000, high: 90165000, close: 88066000, gregorian: '2025-09-08', persian: '1404-06-17' },
  { open: 87651000, low: 87544000, high: 88941000, close: 88198000, gregorian: '2025-09-07', persian: '1404-06-16' },
  { open: 86141000, low: 86141000, high: 88433000, close: 87646000, gregorian: '2025-09-06', persian: '1404-06-15' },
  { open: 87621000, low: 85928000, high: 87621000, close: 86148000, gregorian: '2025-09-04', persian: '1404-06-13' },
  { open: 87669000, low: 86575000, high: 87995000, close: 87602000, gregorian: '2025-09-03', persian: '1404-06-12' },
  { open: 89417000, low: 86852000, high: 89417000, close: 87692000, gregorian: '2025-09-02', persian: '1404-06-11' },
  { open: 86101000, low: 86101000, high: 89726000, close: 89407000, gregorian: '2025-08-31', persian: '1404-06-09' },
  { open: 83446000, low: 83446000, high: 88064000, close: 86118000, gregorian: '2025-08-30', persian: '1404-06-08' },
  { open: 82975000, low: 82675000, high: 84278000, close: 83435000, gregorian: '2025-08-28', persian: '1404-06-06' },
  { open: 80948000, low: 80805000, high: 83100000, close: 82964000, gregorian: '2025-08-27', persian: '1404-06-05' },
  { open: 78638000, low: 78638000, high: 79822000, close: 79674000, gregorian: '2025-08-26', persian: '1404-06-04' },
  { open: 77654000, low: 77654000, high: 78783000, close: 78617000, gregorian: '2025-08-25', persian: '1404-06-03' },
  { open: 78455000, low: 76881000, high: 78455000, close: 77647000, gregorian: '2025-08-23', persian: '1404-06-01' },
  { open: 77324000, low: 77324000, high: 78621000, close: 78453000, gregorian: '2025-08-21', persian: '1404-05-30' },
  { open: 75959000, low: 75959000, high: 77375000, close: 77352000, gregorian: '2025-08-20', persian: '1404-05-29' },
  { open: 75867000, low: 75867000, high: 76567000, close: 75932000, gregorian: '2025-08-19', persian: '1404-05-28' },
  { open: 75121000, low: 75121000, high: 76082000, close: 75869000, gregorian: '2025-08-18', persian: '1404-05-27' },
  { open: 73997000, low: 73997000, high: 75389000, close: 75131000, gregorian: '2025-08-17', persian: '1404-05-26' },
  { open: 76225000, low: 73854000, high: 76225000, close: 74018000, gregorian: '2025-08-16', persian: '1404-05-25' },
  { open: 75791000, low: 75609000, high: 76243000, close: 76237000, gregorian: '2025-08-13', persian: '1404-05-22' },
  { open: 74974000, low: 74339000, high: 75089000, close: 74496000, gregorian: '2025-08-12', persian: '1404-05-21' },
  { open: 74925000, low: 74870000, high: 75482000, close: 74964000, gregorian: '2025-08-11', persian: '1404-05-20' },
  { open: 74579000, low: 74177000, high: 75158000, close: 74923000, gregorian: '2025-08-10', persian: '1404-05-19' },
  { open: 75953000, low: 74316000, high: 75953000, close: 74577000, gregorian: '2025-08-09', persian: '1404-05-18' },
  { open: 75941000, low: 75819000, high: 76357000, close: 75934000, gregorian: '2025-08-06', persian: '1404-05-15' },
  { open: 76497000, low: 75218000, high: 76497000, close: 75927000, gregorian: '2025-08-05', persian: '1404-05-14' },
  { open: 76747000, low: 74877000, high: 77273000, close: 76410000, gregorian: '2025-08-04', persian: '1404-05-13' },
  { open: 75126000, low: 75057000, high: 76899000, close: 76724000, gregorian: '2025-08-03', persian: '1404-05-12' },
  { open: 73965000, low: 73965000, high: 75782000, close: 75248000, gregorian: '2025-08-02', persian: '1404-05-11' },
  { open: 72116000, low: 72099000, high: 74274000, close: 73981000, gregorian: '2025-08-01', persian: '1404-05-10' },
  { open: 71499000, low: 71499000, high: 72434000, close: 72109000, gregorian: '2025-07-30', persian: '1404-05-08' },
  { open: 71455000, low: 71370000, high: 71903000, close: 71485000, gregorian: '2025-07-29', persian: '1404-05-07' },
  { open: 71250000, low: 71248000, high: 71880000, close: 71441000, gregorian: '2025-07-28', persian: '1404-05-06' },
  { open: 70282000, low: 70282000, high: 71737000, close: 71224000, gregorian: '2025-07-27', persian: '1404-05-05' },
  { open: 70119000, low: 69724000, high: 70308000, close: 70255000, gregorian: '2025-07-26', persian: '1404-05-04' },
  { open: 71086000, low: 69932000, high: 71151000, close: 70086000, gregorian: '2025-07-25', persian: '1404-05-03' },
  { open: 71347000, low: 70968000, high: 71347000, close: 71070000, gregorian: '2025-07-23', persian: '1404-05-01' },
  { open: 72499000, low: 71268000, high: 72499000, close: 71344000, gregorian: '2025-07-22', persian: '1404-04-31' },
  { open: 71490000, low: 71347000, high: 71993000, close: 71825000, gregorian: '2025-07-21', persian: '1404-04-30' },
  { open: 69428000, low: 69428000, high: 70855000, close: 70786000, gregorian: '2025-07-20', persian: '1404-04-29' },
  { open: 69842000, low: 69246000, high: 69922000, close: 69451000, gregorian: '2025-07-19', persian: '1404-04-28' },
  { open: 70804000, low: 69851000, high: 70804000, close: 69851000, gregorian: '2025-07-18', persian: '1404-04-27' },
  { open: 71278000, low: 70737000, high: 71344000, close: 70818000, gregorian: '2025-07-16', persian: '1404-04-25' },
  { open: 71091000, low: 70668000, high: 71465000, close: 71275000, gregorian: '2025-07-15', persian: '1404-04-24' },
  { open: 71716000, low: 71206000, high: 72630000, close: 71261000, gregorian: '2025-07-14', persian: '1404-04-23' },
  { open: 69641000, low: 69636000, high: 72083000, close: 71557000, gregorian: '2025-07-12', persian: '1404-04-21' },
  { open: 70656000, low: 69347000, high: 70656000, close: 69664000, gregorian: '2025-07-11', persian: '1404-04-20' },
  { open: 70465000, low: 70149000, high: 70749000, close: 70553000, gregorian: '2025-07-09', persian: '1404-04-18' },
  { open: 69477000, low: 69237000, high: 70578000, close: 70331000, gregorian: '2025-07-08', persian: '1404-04-17' },
  { open: 71465000, low: 69015000, high: 71465000, close: 69324000, gregorian: '2025-07-07', persian: '1404-04-16' },
  { open: 74390000, low: 71139000, high: 74390000, close: 71388000, gregorian: '2025-07-06', persian: '1404-04-15' },
  { open: 74925000, low: 73861000, high: 75459000, close: 74371000, gregorian: '2025-07-02', persian: '1404-04-11' },
  { open: 74025000, low: 72951000, high: 75223000, close: 74997000, gregorian: '2025-07-01', persian: '1404-04-10' },
  { open: 73418000, low: 73418000, high: 76059000, close: 74073000, gregorian: '2025-06-30', persian: '1404-04-09' },
  { open: 70871000, low: 70857000, high: 74597000, close: 73563000, gregorian: '2025-06-29', persian: '1404-04-08' },
  { open: 67422000, low: 67413000, high: 71418000, close: 70675000, gregorian: '2025-06-28', persian: '1404-04-07' },
  { open: 67173000, low: 66912000, high: 67858000, close: 67441000, gregorian: '2025-06-27', persian: '1404-04-06' },
];

async function importHistoricalData() {
  console.log('🚀 Starting 18 Karat Gold historical OHLC data import...\n');

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/currency';
  console.log(`🔌 Connecting to MongoDB: ${mongoUri.replace(/\/\/[^@]+@/, '//***:***@')}\n`);

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB\n');

  try {
    // Create models
    const HistoricalOhlc = mongoose.model('HistoricalOhlc', HistoricalOhlcSchema);
    const CurrentPrice = mongoose.model('CurrentPrice', CurrentPriceSchema);

    console.log('📊 Processing 18 Karat Gold historical data...\n');

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // Process each data point
    for (const dataPoint of GOLD_18K_HISTORICAL_DATA) {
      const { open, high, low, close, gregorian } = dataPoint;

      // Convert from Rial to Toman (divide by 10)
      // Backend standard: all prices stored in Toman
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
        itemCode: '18ayar',
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
        itemCode: '18ayar',
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
    const latestData = GOLD_18K_HISTORICAL_DATA[0];
    const previousData = GOLD_18K_HISTORICAL_DATA[1];

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
      itemCode: '18ayar',
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
      { itemCode: '18ayar' },
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
    console.log(`📅 Date Range:    ${GOLD_18K_HISTORICAL_DATA[GOLD_18K_HISTORICAL_DATA.length - 1].gregorian} to ${GOLD_18K_HISTORICAL_DATA[0].gregorian}`);
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
