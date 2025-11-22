import axios from 'axios';

const PERSIANAPI_KEY = 'vfkxjvy1iuaopyzfxz61';
const BASE_URL = 'https://studio.persianapi.com/web-service';

async function testPersianAPI() {
  console.log('🧪 Testing PersianAPI endpoints...\n');

  try {
    // Test 1: Forex/Currencies
    console.log('📊 Testing /common/forex endpoint:');
    const forexResponse = await axios.get(`${BASE_URL}/common/forex`, {
      headers: {
        'Authorization': `Bearer ${PERSIANAPI_KEY}`,
      },
    });
    console.log('✅ Forex Response:');
    console.log(JSON.stringify(forexResponse.data, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 2: Crypto
    console.log('💰 Testing /crypto endpoint:');
    const cryptoResponse = await axios.get(`${BASE_URL}/crypto`, {
      headers: {
        'Authorization': `Bearer ${PERSIANAPI_KEY}`,
      },
    });
    console.log('✅ Crypto Response:');
    console.log(JSON.stringify(cryptoResponse.data, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 3: Gold
    console.log('🏆 Testing /gold endpoint:');
    const goldResponse = await axios.get(`${BASE_URL}/gold`, {
      headers: {
        'Authorization': `Bearer ${PERSIANAPI_KEY}`,
      },
    });
    console.log('✅ Gold Response:');
    console.log(JSON.stringify(goldResponse.data, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      console.error('Response status:', error.response.status);
    }
  }
}

testPersianAPI();
