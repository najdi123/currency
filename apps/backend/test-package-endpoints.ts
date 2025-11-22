import axios from 'axios';

const PERSIANAPI_KEY = 'vfkxjvy1iuaopyzfxz61';
const BASE_URL = 'https://studio.persianapi.com/index.php';

async function testPackageEndpoints() {
  console.log('🧪 Testing Endpoints Based on Package Contents\n');
  console.log('='.repeat(80) + '\n');

  const endpoints = [
    // Currency endpoints (based on package: ارز آزاد، ارز بانکی، ارز سنا)
    { path: '/web-service/currency/free', name: 'Free Market Currency (ارز آزاد)', expected: 'Dollar, Euro, Pound, Dirham in Rial' },
    { path: '/web-service/currency/bank', name: 'Bank Currency (ارز بانکی)', expected: 'Dollar, Euro, Pound, Dirham - government rates' },
    { path: '/web-service/currency/sana', name: 'Sana Currency Buy (ارز سنا)', expected: 'Dollar, Euro, Dirham - Sana rates' },
    { path: '/web-service/currency/sana-sell', name: 'Sana Currency Sell', expected: 'Sana sell rates' },

    // Gold endpoints (based on package: آبشده، 18 عیار، 24 عیار)
    { path: '/web-service/gold', name: 'Gold Market (بازار طلا)', expected: 'Gold per gram in Rial' },
    { path: '/web-service/gold/melted', name: 'Melted Gold (آبشده)', expected: 'Melted gold prices' },

    // Coin endpoints (based on package: سکه بهارآزادی، امامی، نیم، ربع، گرمی)
    { path: '/web-service/coin', name: 'Coin Market (بازار سکه)', expected: 'Coin prices in Rial' },

    // We know this works:
    { path: '/web-service/common', name: 'Common Markets (WORKING)', expected: 'Energy, Commodities, Stock indices' },

    // Try forex endpoint for comparison (برابری ارزها)
    { path: '/web-service/common/forex', name: 'Currency Parity/Forex (برابری ارزها)', expected: 'EUR/USD, GBP/USD pairs' },
  ];

  for (const endpoint of endpoints) {
    console.log(`\n📊 Testing: ${endpoint.name}`);
    console.log(`   Path: ${endpoint.path}`);
    console.log(`   Expected: ${endpoint.expected}`);
    console.log('-'.repeat(80));

    try {
      const response = await axios.get(`${BASE_URL}${endpoint.path}`, {
        headers: {
          'Authorization': `Bearer ${PERSIANAPI_KEY}`,
        },
        params: {
          limit: 10,
        },
        timeout: 10000,
      });

      console.log('✅ SUCCESS');

      // Handle different response structures
      const list = response.data?.result?.list || response.data?.result?.data || response.data?.data || [];

      if (Array.isArray(list)) {
        console.log(`   Found ${list.length} items`);

        if (list.length > 0) {
          console.log('   Sample items:');
          list.slice(0, 3).forEach((item: any, index: number) => {
            const title = item.Title || item.عنوان || item.title || 'N/A';
            const price = item.Price || item.قیمت || item.price || 'N/A';
            const category = item.Category || item.category || 'N/A';

            console.log(`   ${index + 1}. ${title}`);
            console.log(`      Price: ${price}`);
            console.log(`      Category: ${category}`);

            // Check if this looks like what we need
            if (title.includes('/')) {
              console.log(`      ⚠️  Forex pair format`);
            } else if (price && !isNaN(parseFloat(String(price)))) {
              const priceNum = parseFloat(String(price));
              if (priceNum > 10000) {
                console.log(`      ✅ Looks like Rial/Toman price! (${priceNum.toLocaleString()})`);
              } else {
                console.log(`      ⚠️  Might be USD/international price (${priceNum})`);
              }
            }
          });
        }
      } else if (typeof list === 'object') {
        console.log('   Response is an object (might need different parsing)');
      }

      console.log('\n');
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log('❌ NOT FOUND (404) - Endpoint does not exist or not in your package');
      } else if (error.response?.status === 403) {
        console.log('❌ FORBIDDEN (403) - Not included in your package');
      } else if (error.response?.status === 500) {
        console.log('❌ SERVER ERROR (500)');
      } else if (error.response?.status) {
        console.log(`❌ ERROR ${error.response.status}`);
      } else {
        console.log(`❌ ERROR: ${error.message}`);
      }
      console.log('\n');
    }
  }

  console.log('='.repeat(80));
  console.log('\n📋 NEXT STEPS:\n');
  console.log('Endpoints that work = Available in your package');
  console.log('Look for endpoints returning prices > 10,000 = Likely Rial/Toman prices');
  console.log('Prices < 100 = Likely USD/international prices');
}

testPackageEndpoints();
