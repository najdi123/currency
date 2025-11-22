import axios from 'axios';

const PERSIANAPI_KEY = 'vfkxjvy1iuaopyzfxz61';
const BASE_URL = 'https://studio.persianapi.com';

async function testOpenAPIPaths() {
  console.log('🧪 Testing Exact OpenAPI Paths\n');
  console.log('='.repeat(80) + '\n');

  const endpoints = [
    // Gold endpoints from OpenAPI spec
    { path: '/web-service/gold/', name: 'Gold Pricing' },
    { path: '/web-service/gold/live', name: 'Gold Live Trading' },
    { path: '/web-service/list/melted-gold', name: 'Refined Gold' },

    // Crypto endpoints from OpenAPI spec
    { path: '/web-service/list/crypto/crypto', name: 'Cryptocurrency Listings' },
    { path: '/web-service/list/crypto/crypto-fast', name: 'Fast Crypto Data' },

    // Currency endpoints from OpenAPI spec
    { path: '/web-service/list/forex', name: 'Forex (Trading Pairs)' },
    { path: '/web-service/list/currency', name: 'Comprehensive Currency Markets' },
    { path: '/web-service/list/dollar', name: 'Dollar Price' },

    // We know this one works:
    { path: '/web-service/common/forex', name: 'Common Forex (KNOWN WORKING)' },

    // Try common prefix variations:
    { path: '/web-service/common/gold', name: 'Common Gold' },
    { path: '/web-service/common/crypto', name: 'Common Crypto' },
    { path: '/web-service/common/coin', name: 'Common Coin' },
    { path: '/web-service/common/currency', name: 'Common Currency' },
  ];

  for (const endpoint of endpoints) {
    console.log(`\n📊 Testing: ${endpoint.name}`);
    console.log(`   Path: ${endpoint.path}`);
    console.log('-'.repeat(80));

    try {
      const response = await axios.get(`${BASE_URL}${endpoint.path}`, {
        headers: {
          'Authorization': `Bearer ${PERSIANAPI_KEY}`,
        },
        params: {
          limit: 3,
        },
        timeout: 10000,
      });

      console.log('✅ SUCCESS');

      // Try to extract data
      const rawData = response.data;
      const data = rawData?.result?.data || rawData?.data || rawData?.result || rawData;

      if (Array.isArray(data)) {
        console.log(`   Found ${data.length} items`);

        if (data.length > 0) {
          console.log('\n   Sample item 1:');
          const item = data[0];
          console.log(`   Title: ${item.عنوان || item.title || 'N/A'}`);
          console.log(`   Category: ${item.category || 'N/A'}`);
          console.log(`   Price/Value: ${item.قیمت || item.price || item.value || 'N/A'}`);
          console.log(`   Available fields: ${Object.keys(item).slice(0, 10).join(', ')}`);

          // Analyze if it's forex pairs or individual items
          const title = item.عنوان || item.title || '';
          if (title.includes('/')) {
            console.log(`   ⚠️  FORMAT: Trading Pair (e.g., USD/EUR)`);
          } else {
            console.log(`   ✅ FORMAT: Individual Item`);
          }
        }
      } else if (typeof data === 'object' && data !== null) {
        const keys = Object.keys(data);
        console.log(`   Response is object with ${keys.length} keys`);
        console.log(`   Keys: ${keys.slice(0, 10).join(', ')}`);
      } else {
        console.log(`   Response type: ${typeof data}`);
      }

      console.log('\n');
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log('❌ NOT FOUND (404) - Endpoint does not exist');
      } else if (error.response?.status === 500) {
        console.log('❌ SERVER ERROR (500)');
        if (error.response?.data?.message) {
          console.log(`   Message: ${error.response.data.message}`);
        }
      } else if (error.response?.status === 401) {
        console.log('❌ UNAUTHORIZED (401) - Auth issue');
      } else if (error.response?.status === 403) {
        console.log('❌ FORBIDDEN (403) - Access denied');
      } else if (error.response?.status) {
        console.log(`❌ ERROR ${error.response.status}`);
      } else {
        console.log(`❌ ERROR: ${error.message}`);
      }
      console.log('\n');
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📋 SUMMARY:\n');
  console.log('Looking for endpoints that return:');
  console.log('  ✅ Individual currency prices (USD, EUR, GBP) in Rial/Toman');
  console.log('  ✅ Gold prices in Rial/Toman');
  console.log('  ✅ Crypto prices in Rial/Toman');
  console.log('\n  ❌ NOT forex trading pairs (USD/EUR, GBP/USD)');
}

testOpenAPIPaths();
