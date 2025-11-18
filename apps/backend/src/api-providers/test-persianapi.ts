/**
 * PersianAPI Connection Test Script
 *
 * Run with: npx ts-node src/api-providers/test-persianapi.ts
 */

import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PersianApiProvider } from './persianapi.provider';
import * as dotenv from 'dotenv';
import { HttpModule } from '@nestjs/axios';
import axios from 'axios';
import * as path from 'path';

// Load environment variables from backend .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testPersianAPI() {
  console.log('🧪 Testing PersianAPI Connection...\n');

  // Create HTTP service manually
  const httpService = new HttpService(axios.create());

  // Create config service manually
  const configService = {
    get: (key: string) => process.env[key],
  } as ConfigService;

  // Create provider instance
  const provider = new PersianApiProvider(httpService, configService);

  try {
    // Test 1: Validate API Key
    console.log('1️⃣  Testing API key validation...');
    const isValid = await provider.validateApiKey();
    console.log(isValid ? '   ✅ API key is valid\n' : '   ❌ API key is invalid\n');

    if (!isValid) {
      console.error('❌ Cannot proceed - API key validation failed');
      process.exit(1);
    }

    // Test 2: Check raw response format first
    console.log('2️⃣  Checking raw API response format...');
    const testUrl = 'https://studio.persianapi.com/web-service/common/forex';
    const testResponse = await axios.get(testUrl, {
      headers: { Authorization: `Bearer ${process.env.PERSIANAPI_KEY}` },
      params: { format: 'json', limit: 3 }
    });
    console.log('   Raw response type:', typeof testResponse.data);
    console.log('   Is array?:', Array.isArray(testResponse.data));
    console.log('   Response keys:', Object.keys(testResponse.data).slice(0, 5));
    console.log('   Sample data:', JSON.stringify(testResponse.data).substring(0, 200) + '...');
    console.log('');

    // Test 3: Fetch Crypto
    console.log('3️⃣  Fetching cryptocurrencies...');
    const crypto = await provider.fetchCrypto({ limit: 5 });
    console.log(`   ✅ Fetched ${crypto.length} cryptocurrencies`);
    console.log('   Sample:', crypto.slice(0, 2).map(c => ({
      code: c.code,
      name: c.name,
      price: c.price
    })));
    console.log('');

    // Test 4: Fetch Gold (may fail if endpoint unavailable)
    console.log('4️⃣  Fetching gold prices...');
    try {
      const gold = await provider.fetchGold({ limit: 5 });
      console.log(`   ✅ Fetched ${gold.length} gold items`);
      console.log('   Sample:', gold.slice(0, 2).map(g => ({
        code: g.code,
        name: g.name,
        price: g.price
      })));
    } catch (error: any) {
      console.log(`   ⚠️  Gold endpoint unavailable (${error.message})`);
    }
    console.log('');

    // Test 5: Fetch Coins (may fail if endpoint unavailable)
    console.log('5️⃣  Fetching coins...');
    try {
      const coins = await provider.fetchCoins({ limit: 5 });
      console.log(`   ✅ Fetched ${coins.length} coins`);
      console.log('   Sample:', coins.slice(0, 2).map(c => ({
        code: c.code,
        name: c.name,
        price: c.price
      })));
    } catch (error: any) {
      console.log(`   ⚠️  Coins endpoint unavailable (${error.message})`);
    }
    console.log('');

    // Test 6: Fetch All
    console.log('6️⃣  Fetching all data at once...');
    const allData = await provider.fetchAll({ limit: 3 });
    console.log(`   ✅ Fetched all data:`);
    console.log(`      - ${allData.currencies.length} currencies`);
    console.log(`      - ${allData.crypto.length} cryptocurrencies`);
    console.log(`      - ${allData.gold.length} gold items`);
    console.log(`      - ${allData.coins.length} coins`);
    console.log('');

    // Test 7: Get Rate Limit Status
    console.log('7️⃣  Checking rate limit status...');
    const rateLimit = await provider.getRateLimitStatus();
    console.log(`   ✅ Rate limit: ${rateLimit.remaining} requests remaining`);
    console.log(`      Resets at: ${rateLimit.reset.toLocaleString()}`);
    console.log('');

    // Test 8: Get Metadata
    console.log('8️⃣  Getting provider metadata...');
    const metadata = provider.getMetadata();
    console.log('   ✅ Provider metadata:');
    console.log(`      Name: ${metadata.name}`);
    console.log(`      Base URL: ${metadata.baseUrl}`);
    console.log(`      Rate limit: ${metadata.rateLimitPerSecond} req/sec`);
    console.log('');

    console.log('🎉 All tests passed! PersianAPI is working correctly.\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error?.response?.data) {
      console.error('   API Response:', error.response.data);
    }
    if (error?.statusCode) {
      console.error('   Status Code:', error.statusCode);
    }
    process.exit(1);
  }
}

// Run the test
testPersianAPI();
