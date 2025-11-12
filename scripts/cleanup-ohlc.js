#!/usr/bin/env node

/**
 * OHLC Database Cleanup Script
 *
 * This script completely clears all OHLC data from MongoDB.
 * Use this when you need to start fresh with OHLC data collection.
 *
 * Usage: node scripts/cleanup-ohlc.js
 */

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables from backend directory
require('dotenv').config({ path: path.join(__dirname, '../apps/backend/.env') });

const MONGODB_URI = process.env.MONGODB_URI;

// OHLC collection names
const OHLC_COLLECTIONS = [
  'ohlcsnapshots',
  'ohlc1mdata',
  'ohlc5mdata',
  'ohlc15mdata',
  'ohlc30mdata',
  'ohlc1hdata',
  'ohlc4hdata',
  'ohlc1ddata'
];

async function cleanup() {
  console.log('🧹 Starting OHLC database cleanup...\n');

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Get all collections
    const collections = await db.listCollections().toArray();
    const existingCollections = collections.map(c => c.name);

    console.log('📋 Found collections:', existingCollections.join(', '), '\n');

    let droppedCount = 0;
    let notFoundCount = 0;

    // Drop each OHLC collection
    for (const collectionName of OHLC_COLLECTIONS) {
      if (existingCollections.includes(collectionName)) {
        try {
          await db.dropCollection(collectionName);
          console.log(`✅ Dropped collection: ${collectionName}`);
          droppedCount++;
        } catch (error) {
          console.error(`❌ Failed to drop ${collectionName}:`, error.message);
        }
      } else {
        console.log(`⚠️  Collection not found: ${collectionName}`);
        notFoundCount++;
      }
    }

    console.log('\n📊 Cleanup Summary:');
    console.log(`   - Collections dropped: ${droppedCount}`);
    console.log(`   - Collections not found: ${notFoundCount}`);
    console.log(`   - Total processed: ${OHLC_COLLECTIONS.length}`);

    console.log('\n✨ Database cleanup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Wait for the next minute boundary for data collection to start');
    console.log('   3. Check logs for "Collected X minute OHLC records" message\n');

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run cleanup
cleanup()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
