import axios from 'axios';

const PERSIANAPI_KEY = 'vfkxjvy1iuaopyzfxz61';
const BASE_URL = 'https://studio.persianapi.com/web-service';

async function testCurrencyEndpoints() {
  console.log('🧪 Testing Currency Endpoints for Rial/Toman Prices\n');
  console.log('='.repeat(80) + '\n');

  const endpoints = [
    { path: '/v2/currency/free', name: 'Free Currency Rates (v2)' },
    { path: '/currency/bank', name: 'Government Exchange Rates' },
    { path: '/currency/sarafi', name: 'Exchange Office Rates (Buy)' },
    { path: '/currency/sarafi-sell', name: 'Exchange Office Rates (Sell)' },
    { path: '/list/currency', name: 'Comprehensive Currency Markets' },
    { path: '/list/dollar', name: 'Dollar Price' },
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
        },
        timeout: 10000,
      });

      console.log('✅ SUCCESS');
      console.log('   Response structure:', JSON.stringify(response.data, null, 2).substring(0, 800));

      // Check if it's the common/forex format or a different format
      const data = response.data?.result?.data || response.data?.data || response.data;
      if (Array.isArray(data) && data.length > 0) {
        console.log('\n   Sample items:');
        data.slice(0, 3).forEach((item: any, index: number) => {
          console.log(`   ${index + 1}. Title: ${item.عنوان || item.title || 'N/A'}`);
          console.log(`      Category: ${item.category || 'N/A'}`);
          console.log(`      Price: ${item.قیمت || item.price || item.value || 'N/A'}`);
          console.log(`      Fields: ${Object.keys(item).join(', ')}`);
        });
      }

      console.log('\n');
    } catch (error: any) {
      console.log(`❌ FAILED: ${error.response?.status || 'ERROR'}`);
      if (error.response?.data) {
        console.log('   Error:', JSON.stringify(error.response.data, null, 2).substring(0, 200));
      } else {
        console.log('   Error:', error.message);
      }
      console.log('\n');
    }
  }

  // Also test the endpoints we know exist for comparison
  console.log('\n' + '='.repeat(80));
  console.log('🔍 Testing Known Working Endpoints (for comparison):\n');

  const workingEndpoints = [
    { path: '/list/forex', name: 'Forex Trading Pairs (CURRENT - WRONG DATA)' },
    { path: '/list/crypto/crypto', name: 'Cryptocurrency' },
    { path: '/gold/', name: 'Gold Prices' },
  ];

  for (const endpoint of workingEndpoints) {
    console.log(`\n📊 Testing: ${endpoint.name}`);
    console.log(`   Endpoint: ${endpoint.path}`);
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
      const data = response.data?.result?.data || response.data?.data || response.data;
      if (Array.isArray(data) && data.length > 0) {
        console.log('   Sample items:');
        data.slice(0, 2).forEach((item: any, index: number) => {
          console.log(`   ${index + 1}. ${item.عنوان || item.title || 'N/A'} - ${item.category || 'N/A'}`);
        });
      }
      console.log('\n');
    } catch (error: any) {
      console.log(`❌ FAILED: ${error.response?.status || 'ERROR'}`);
      console.log('\n');
    }
  }
}

testCurrencyEndpoints();
