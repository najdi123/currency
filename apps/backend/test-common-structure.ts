import axios from 'axios';

const PERSIANAPI_KEY = 'vfkxjvy1iuaopyzfxz61';
const BASE_URL = 'https://studio.persianapi.com/index.php';

async function testCommonStructure() {
  console.log('🧪 Testing /web-service/common endpoint structure\n');
  console.log('='.repeat(80) + '\n');

  try {
    const response = await axios.get(`${BASE_URL}/web-service/common`, {
      headers: {
        'Authorization': `Bearer ${PERSIANAPI_KEY}`,
      },
      params: {
        limit: 50,
        page: 1,
      },
      timeout: 15000,
    });

    console.log('✅ SUCCESS\n');
    console.log('Full response structure:');
    console.log(JSON.stringify(response.data, null, 2).substring(0, 3000));
    console.log('\n...\n');

    // Try to extract the data
    const rawData = response.data;
    console.log('\nResponse keys:', Object.keys(rawData).join(', '));

    // Check different possible structures
    if (rawData.result) {
      console.log('\nHas "result" key');
      console.log('Result keys:', Object.keys(rawData.result).join(', '));

      if (rawData.result.data) {
        console.log('Result.data type:', typeof rawData.result.data);
        console.log('Result.data is array?', Array.isArray(rawData.result.data));

        if (typeof rawData.result.data === 'object' && !Array.isArray(rawData.result.data)) {
          console.log('\nResult.data is an object with keys:');
          const keys = Object.keys(rawData.result.data);
          console.log(`Total keys: ${keys.length}`);
          console.log('First 20 keys:', keys.slice(0, 20).join(', '));

          // Sample a few items
          console.log('\n\nSample items from result.data:');
          keys.slice(0, 5).forEach((key, index) => {
            const item = rawData.result.data[key];
            console.log(`\n${index + 1}. Key: ${key}`);
            console.log(`   Value:`, JSON.stringify(item, null, 2).substring(0, 300));
          });
        }
      }
    }

  } catch (error: any) {
    console.error('❌ Error:', error.response?.status || error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testCommonStructure();
