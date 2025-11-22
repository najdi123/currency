/**
 * Test Base Package Endpoints
 *
 * According to PersianAPI support, the base package gives access to:
 * 1. /web-service/common/gold-currency-coin - Important items (gold, currency, coin)
 * 2. /web-service/common/digitalcurrency - Digital currencies/crypto
 * 3. /web-service/common/forex - Currency exchange rates (برابری ارزها)
 * 4. /web-service/common (general data)
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const apiKey = process.env.PERSIANAPI_KEY;
const baseUrl = 'https://studio.persianapi.com/web-service';

async function testEndpoint(name: string, url: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${name}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(80));

  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 10000,
    });

    console.log(`✅ Status: ${response.status}`);
    console.log(`\n📊 Response structure:`);
    console.log(`   Type: ${typeof response.data}`);
    console.log(`   Is Array: ${Array.isArray(response.data)}`);

    if (response.data) {
      if (Array.isArray(response.data)) {
        console.log(`   Array length: ${response.data.length}`);
        console.log(`\n📋 First 3 items:`);
        response.data.slice(0, 3).forEach((item: any, idx: number) => {
          console.log(`\n   Item ${idx + 1}:`, JSON.stringify(item, null, 2).split('\n').map((l: string) => '   ' + l).join('\n').trim());
        });
      } else if (typeof response.data === 'object') {
        const keys = Object.keys(response.data);
        console.log(`   Object keys (${keys.length}):`, keys.slice(0, 10));

        // Check for nested data
        if (response.data.result) {
          console.log(`\n   ✨ Found 'result' wrapper:`);
          console.log(`   Result type: ${typeof response.data.result}`);
          console.log(`   Result is array: ${Array.isArray(response.data.result)}`);

          if (response.data.result.data) {
            console.log(`   ✨ Found 'result.data':`);
            console.log(`   Data type: ${typeof response.data.result.data}`);
            console.log(`   Data is array: ${Array.isArray(response.data.result.data)}`);
            if (Array.isArray(response.data.result.data)) {
              console.log(`   Data array length: ${response.data.result.data.length}`);
              console.log(`\n📋 First 3 data items:`);
              response.data.result.data.slice(0, 3).forEach((item: any, idx: number) => {
                console.log(`\n   Item ${idx + 1}:`, JSON.stringify(item, null, 2).split('\n').map((l: string) => '   ' + l).join('\n').trim());
              });
            }
          }

          if (response.data.result.list) {
            console.log(`   ✨ Found 'result.list':`);
            console.log(`   List type: ${typeof response.data.result.list}`);
            console.log(`   List is array: ${Array.isArray(response.data.result.list)}`);
            if (Array.isArray(response.data.result.list)) {
              console.log(`   List array length: ${response.data.result.list.length}`);
              console.log(`\n📋 First 3 list items:`);
              response.data.result.list.slice(0, 3).forEach((item: any, idx: number) => {
                console.log(`\n   Item ${idx + 1}:`, JSON.stringify(item, null, 2).split('\n').map((l: string) => '   ' + l).join('\n').trim());
              });
            }
          }
        }

        console.log(`\n   Raw sample:`, JSON.stringify(response.data).substring(0, 300) + '...');
      }
    }

    return { success: true, count: response.data?.result?.data?.length || response.data?.result?.list?.length || response.data?.length || 0 };
  } catch (error: any) {
    console.log(`❌ Failed: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Response:`, JSON.stringify(error.response.data, null, 2));
    }
    return { success: false, count: 0 };
  }
}

async function main() {
  console.log('🧪 Testing PersianAPI Base Package Access');
  console.log(`API Key: ${apiKey?.substring(0, 10)}...`);
  console.log('\n');

  const results: { name: string; url: string; success: boolean; count: number }[] = [];

  // Test 1: Combined gold-currency-coin endpoint (recommended by support)
  let result = await testEndpoint(
    '1. Gold + Currency + Coin (Combined)',
    `${baseUrl}/common/gold-currency-coin?format=json&limit=100&page=1`
  );
  results.push({ name: 'Gold-Currency-Coin', url: '/common/gold-currency-coin', ...result });

  await sleep(5000); // Rate limit: 1 req per 5 seconds

  // Test 2: Digital currency endpoint
  result = await testEndpoint(
    '2. Digital Currency (Crypto)',
    `${baseUrl}/common/digitalcurrency?format=json&limit=100&page=1`
  );
  results.push({ name: 'Digital Currency', url: '/common/digitalcurrency', ...result });

  await sleep(5000);

  // Test 3: Forex endpoint
  result = await testEndpoint(
    '3. Forex (Currency Exchange Rates)',
    `${baseUrl}/common/forex?format=json&limit=100&page=1`
  );
  results.push({ name: 'Forex', url: '/common/forex', ...result });

  await sleep(5000);

  // Test 4: General common endpoint
  result = await testEndpoint(
    '4. Common (General Data)',
    `${baseUrl}/common?format=json&limit=100&page=1`
  );
  results.push({ name: 'Common', url: '/common', ...result });

  await sleep(5000);

  // Test 5: Individual endpoints (may not work with base package)
  console.log('\n\n' + '='.repeat(80));
  console.log('Testing Individual Endpoints (may be restricted):');
  console.log('='.repeat(80));

  result = await testEndpoint(
    '5. Gold Only',
    `${baseUrl}/gold?format=json&limit=50`
  );
  results.push({ name: 'Gold Only', url: '/gold', ...result });

  await sleep(5000);

  result = await testEndpoint(
    '6. Coin Only',
    `${baseUrl}/coin/cash?format=json&limit=50`
  );
  results.push({ name: 'Coin Only', url: '/coin/cash', ...result });

  await sleep(5000);

  result = await testEndpoint(
    '7. Currency Free Market',
    `${baseUrl}/currency/free?format=json&limit=50`
  );
  results.push({ name: 'Currency Free', url: '/currency/free', ...result });

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 SUMMARY OF AVAILABLE ENDPOINTS');
  console.log('='.repeat(80));
  console.log('\n✅ Working Endpoints:\n');

  results.filter(r => r.success).forEach(r => {
    console.log(`   ✅ ${r.name.padEnd(30)} ${r.url.padEnd(35)} (${r.count} items)`);
  });

  console.log('\n❌ Restricted Endpoints:\n');
  results.filter(r => !r.success).forEach(r => {
    console.log(`   ❌ ${r.name.padEnd(30)} ${r.url}`);
  });

  console.log('\n' + '='.repeat(80));
  const workingCount = results.filter(r => r.success).length;
  const totalItems = results.filter(r => r.success).reduce((sum, r) => sum + r.count, 0);
  console.log(`\n✅ You have access to ${workingCount}/${results.length} endpoints`);
  console.log(`📦 Total items available: ${totalItems}`);
  console.log('\n' + '='.repeat(80));
}

function sleep(ms: number): Promise<void> {
  console.log(`\n⏳ Waiting ${ms / 1000}s for rate limit...`);
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
