import axios from 'axios';

const PERSIANAPI_KEY = 'vfkxjvy1iuaopyzfxz61';
const BASE_URL = 'https://studio.persianapi.com/web-service';

async function testEndpoints() {
  const endpoints = [
    '/common/crypto',
    '/common/gold',
    '/common/coin',
    '/common/coins',
    '/market/crypto',
    '/market/gold',
    '/digital',
    '/digital-currency',
    '/cryptocurrency',
    '/precious-metals',
    '/gold',
    '/crypto',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${BASE_URL}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${PERSIANAPI_KEY}` },
        timeout: 5000,
      });
      console.log(`✅ ${endpoint} - SUCCESS`);
      console.log(JSON.stringify(response.data, null, 2).substring(0, 500));
      console.log('\n---\n');
    } catch (error: any) {
      console.log(`❌ ${endpoint} - ${error.response?.status || 'ERROR'}: ${error.response?.data?.message || error.message}`);
    }
  }
}

testEndpoints();
