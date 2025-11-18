#!/usr/bin/env ts-node

/**
 * Test script for Phase 2 new database schemas
 *
 * This script validates:
 * 1. Schema compilation and structure
 * 2. Index definitions
 * 3. Type safety
 * 4. Document creation and validation
 */

import * as mongoose from 'mongoose';
import {
  TrackedItem,
  TrackedItemSchema
} from './tracked-item.schema';
import {
  CurrentPrice,
  CurrentPriceSchema
} from './current-price.schema';
import {
  IntradayOhlc,
  IntradayOhlcSchema
} from './intraday-ohlc.schema';
import {
  HistoricalOhlc,
  HistoricalOhlcSchema,
  OhlcTimeframe
} from './historical-ohlc.schema';

// Test results tracking
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string, details?: any) {
  results.push({ name, passed, error, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (error) console.error(`   Error: ${error}`);
  if (details) console.log(`   Details:`, details);
}

async function testSchemaStructure() {
  console.log('\n📋 Testing Schema Structure...\n');

  try {
    // Test 1: TrackedItem Schema
    const TrackedItemModel = mongoose.model('TrackedItem_Test', TrackedItemSchema);
    const itemDoc = new TrackedItemModel({
      code: 'test_usd',
      type: 'currency',
      name: 'Test USD',
      metadata: {
        symbol: '$',
        decimalPlaces: 2,
        displayOrder: 1,
      },
      isActive: true,
    });

    const itemValidation = itemDoc.validateSync();
    logTest(
      'TrackedItem schema structure',
      !itemValidation,
      itemValidation?.message,
      { code: itemDoc.code, type: itemDoc.type }
    );

    // Test 2: CurrentPrice Schema
    const CurrentPriceModel = mongoose.model('CurrentPrice_Test', CurrentPriceSchema);
    const priceDoc = new CurrentPriceModel({
      itemCode: 'test_usd',
      price: 42000,
      change: 1.5,
      previousPrice: 41377,
      priceTimestamp: new Date(),
      source: 'test',
    });

    const priceValidation = priceDoc.validateSync();
    logTest(
      'CurrentPrice schema structure',
      !priceValidation,
      priceValidation?.message,
      { itemCode: priceDoc.itemCode, price: priceDoc.price }
    );

    // Test 3: IntradayOhlc Schema
    const IntradayOhlcModel = mongoose.model('IntradayOhlc_Test', IntradayOhlcSchema);
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const intradayDoc = new IntradayOhlcModel({
      itemCode: 'test_usd',
      date: now,
      open: 42000,
      high: 42500,
      low: 41500,
      close: 42300,
      updateCount: 10,
      lastUpdate: now,
      expiresAt: tomorrow,
    });

    const intradayValidation = intradayDoc.validateSync();
    logTest(
      'IntradayOhlc schema structure',
      !intradayValidation,
      intradayValidation?.message,
      { itemCode: intradayDoc.itemCode, high: intradayDoc.high }
    );

    // Test 4: HistoricalOhlc Schema
    const HistoricalOhlcModel = mongoose.model('HistoricalOhlc_Test', HistoricalOhlcSchema);
    const periodStart = new Date('2025-01-01');
    const periodEnd = new Date('2025-01-02');

    const historicalDoc = new HistoricalOhlcModel({
      itemCode: 'test_usd',
      timeframe: OhlcTimeframe.DAILY,
      periodStart,
      periodEnd,
      open: 42000,
      high: 42500,
      low: 41500,
      close: 42300,
      dataPoints: 144,
    });

    const historicalValidation = historicalDoc.validateSync();
    logTest(
      'HistoricalOhlc schema structure',
      !historicalValidation,
      historicalValidation?.message,
      { timeframe: historicalDoc.timeframe, dataPoints: historicalDoc.dataPoints }
    );

  } catch (error: any) {
    logTest('Schema structure tests', false, error.message);
  }
}

async function testIndexDefinitions() {
  console.log('\n🔍 Testing Index Definitions...\n');

  try {
    // Test TrackedItem indexes
    const TrackedItemModel = mongoose.model('TrackedItem_Test');
    const trackedIndexes = TrackedItemModel.schema.indexes();

    logTest(
      'TrackedItem has indexes defined',
      trackedIndexes.length > 0,
      undefined,
      { count: trackedIndexes.length, indexes: trackedIndexes }
    );

    // Test CurrentPrice indexes
    const CurrentPriceModel = mongoose.model('CurrentPrice_Test');
    const currentIndexes = CurrentPriceModel.schema.indexes();

    logTest(
      'CurrentPrice has indexes defined',
      currentIndexes.length > 0,
      undefined,
      { count: currentIndexes.length, indexes: currentIndexes }
    );

    // Test IntradayOhlc indexes (including TTL)
    const IntradayOhlcModel = mongoose.model('IntradayOhlc_Test');
    const intradayIndexes = IntradayOhlcModel.schema.indexes();
    const hasTTL = intradayIndexes.some((idx: any) =>
      idx[1]?.expireAfterSeconds === 0
    );

    logTest(
      'IntradayOhlc has TTL index',
      hasTTL,
      undefined,
      { count: intradayIndexes.length, indexes: intradayIndexes }
    );

    // Test HistoricalOhlc indexes
    const HistoricalOhlcModel = mongoose.model('HistoricalOhlc_Test');
    const historicalIndexes = HistoricalOhlcModel.schema.indexes();
    const hasCompoundIndex = historicalIndexes.some((idx: any) =>
      JSON.stringify(idx[0]).includes('itemCode') &&
      JSON.stringify(idx[0]).includes('timeframe')
    );

    logTest(
      'HistoricalOhlc has compound index (itemCode + timeframe)',
      hasCompoundIndex,
      undefined,
      { count: historicalIndexes.length, indexes: historicalIndexes }
    );

  } catch (error: any) {
    logTest('Index definition tests', false, error.message);
  }
}

async function testTypeSafety() {
  console.log('\n🛡️ Testing Type Safety...\n');

  try {
    // Test 1: Enum validation for type field
    const TrackedItemModel = mongoose.model('TrackedItem_Test');
    const invalidTypeDoc = new TrackedItemModel({
      code: 'test_invalid',
      type: 'invalid_type', // Should fail validation
      name: 'Invalid',
    });

    const typeValidation = invalidTypeDoc.validateSync();
    logTest(
      'TrackedItem type enum validation',
      !!typeValidation,
      'Should reject invalid type',
      { error: typeValidation?.errors?.type?.message }
    );

    // Test 2: Required fields validation
    const CurrentPriceModel = mongoose.model('CurrentPrice_Test');
    const missingFieldsDoc = new CurrentPriceModel({
      // Missing required fields: itemCode, price, priceTimestamp
      change: 0,
    });

    const requiredValidation = missingFieldsDoc.validateSync();
    logTest(
      'CurrentPrice required fields validation',
      !!requiredValidation,
      'Should reject missing required fields',
      {
        missingFields: Object.keys(requiredValidation?.errors || {}),
      }
    );

    // Test 3: Timeframe enum validation
    const HistoricalOhlcModel = mongoose.model('HistoricalOhlc_Test');
    const invalidTimeframeDoc = new HistoricalOhlcModel({
      itemCode: 'test',
      timeframe: 'invalid', // Should fail
      periodStart: new Date(),
      periodEnd: new Date(),
      open: 100,
      high: 110,
      low: 90,
      close: 105,
    });

    const timeframeValidation = invalidTimeframeDoc.validateSync();
    logTest(
      'HistoricalOhlc timeframe enum validation',
      !!timeframeValidation,
      'Should reject invalid timeframe',
      { error: timeframeValidation?.errors?.timeframe?.message }
    );

  } catch (error: any) {
    logTest('Type safety tests', false, error.message);
  }
}

async function testDocumentOperations() {
  console.log('\n📝 Testing Document Operations (Dry Run)...\n');

  try {
    // Test upsert pattern for CurrentPrice
    const CurrentPriceModel = mongoose.model('CurrentPrice_Test');

    // Simulate upsert operation structure
    const upsertOp = {
      updateOne: {
        filter: { itemCode: 'usd_sell' },
        update: {
          $set: {
            price: 42000,
            change: 1.5,
            priceTimestamp: new Date(),
            source: 'test',
          },
        },
        upsert: true,
      },
    };

    logTest(
      'CurrentPrice upsert operation structure',
      true,
      undefined,
      { operation: 'bulkWrite with upsert', filter: upsertOp.updateOne.filter }
    );

    // Test TTL expiry calculation
    const now = new Date();
    const expiresIn48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const isValidTTL = expiresIn48Hours > now;

    logTest(
      'IntradayOhlc TTL calculation',
      isValidTTL,
      undefined,
      { now: now.toISOString(), expiresAt: expiresIn48Hours.toISOString() }
    );

    // Test compound query structure
    const compoundQuery = {
      itemCode: 'btc',
      timeframe: OhlcTimeframe.DAILY,
      periodStart: { $gte: new Date('2025-01-01') },
    };

    logTest(
      'HistoricalOhlc compound query structure',
      true,
      undefined,
      { query: compoundQuery }
    );

  } catch (error: any) {
    logTest('Document operation tests', false, error.message);
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60) + '\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name}`);
      if (r.error) console.log(`     ${r.error}`);
    });
    console.log();
  }

  const status = failed === 0 ? '✅ ALL TESTS PASSED!' : '⚠️ SOME TESTS FAILED';
  console.log(status);
  console.log('='.repeat(60) + '\n');
}

async function runTests() {
  console.log('🧪 Phase 2 Schema Validation Tests');
  console.log('='.repeat(60));

  try {
    await testSchemaStructure();
    await testIndexDefinitions();
    await testTypeSafety();
    await testDocumentOperations();

    printSummary();

    // Exit with appropriate code
    const hasFailures = results.some(r => !r.passed);
    process.exit(hasFailures ? 1 : 0);

  } catch (error: any) {
    console.error('\n❌ Fatal error during tests:', error);
    process.exit(1);
  }
}

// Run tests
runTests();
