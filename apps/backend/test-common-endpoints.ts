import axios from 'axios';

const PERSIANAPI_KEY = 'vfkxjvy1iuaopyzfxz61';
const BASE_URL = 'https://studio.persianapi.com/web-service';

async function testCommonEndpoints() {
  console.log('🧪 Testing /common/* Endpoints\n');
  console.log('='.repeat(80) + '\n');

  const endpoints = [
    // We know these work:
    { path: '/common/forex', name: 'Forex Trading Pairs (WORKING)' },
    { path: '/crypto', name: 'Cryptocurrency (WORKING)' },
    { path: '/gold', name: 'Gold (WORKING)' },

    // Try variations with /common/ prefix:
    { path: '/common/currency', name: 'Common - Currency' },
    { path: '/common/currencies', name: 'Common - Currencies' },
    { path: '/common/exchange', name: 'Common - Exchange' },
    { path: '/common/dollar', name: 'Common - Dollar' },
    { path: '/common/rial', name: 'Common - Rial' },
    { path: '/common/toman', name: 'Common - Toman' },

    // Try without /common/ prefix:
    { path: '/currency', name: 'Currency' },
    { path: '/currencies', name: 'Currencies' },
    { path: '/exchange', name: 'Exchange' },
    { path: '/dollar', name: 'Dollar' },

    // Try /list/ prefix:
    { path: '/list/currency', name: 'List - Currency' },
    { path: '/list/dollar', name: 'List - Dollar' },
  ];

  for (const endpoint of endpoints) {
    console.log(`\n📊 Testing: ${endpoint.name}`);
    console.log(`   Endpoint: ${endpoint.path}`);
    console.log('-'.repeat(80));

    try {
      const response = await axios.get(`${BASE_URL}${endpoint.path}`, {
        headers: {
          'Authorization': `Bearer ${PERSIANAPI_KEY}`,
        },
        params: {
          limit: 5,
          page: 1,
        },
        timeout: 10000,
      });

      console.log('✅ SUCCESS');

      // Try to extract data from various possible structures
      const data = response.data?.result?.data || response.data?.data || response.data?.result || response.data;

      if (Array.isArray(data)) {
        console.log(`   Found ${data.length} items`);

        if (data.length > 0) {
          console.log('\n   Sample items:');
          data.slice(0, 2).forEach((item: any, index: number) => {
            console.log(`   ${index + 1}. Title: ${item.عنوان || item.title || 'N/A'}`);
            console.log(`      Category: ${item.category || 'N/A'}`);
            console.log(`      Price: ${item.قیمت || item.price || item.value || 'N/A'}`);

            // Check if it looks like forex pairs or individual currencies
            const title = item.عنوان || item.title || '';
            if (title.includes('/')) {
              console.log(`      ⚠️  FOREX PAIR FORMAT (not what we need)`);
            } else {
              console.log(`      ✅ INDIVIDUAL CURRENCY FORMAT (might be what we need)`);
            }
          });
        }
      } else if (typeof data === 'object') {
        console.log('   Response is an object with keys:', Object.keys(data).join(', '));
      }

      console.log('\n');
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log('❌ NOT FOUND (404)');
      } else if (error.response?.status === 500) {
        console.log('❌ SERVER ERROR (500)');
      } else if (error.response?.status) {
        console.log(`❌ FAILED: ${error.response.status}`);
        if (error.response?.data) {
          console.log('   Error:', JSON.stringify(error.response.data).substring(0, 150));
        }
      } else {
        console.log(`❌ ERROR: ${error.message}`);
      }
      console.log('\n');
    }
  }
}

testCommonEndpoints();
