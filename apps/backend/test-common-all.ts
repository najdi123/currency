import axios from 'axios';

const PERSIANAPI_KEY = 'vfkxjvy1iuaopyzfxz61';
const BASE_URL = 'https://studio.persianapi.com/index.php';

async function testCommonEndpoint() {
  console.log('🧪 Testing /web-service/common endpoint\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Fetch more items to see all available data
    const response = await axios.get(`${BASE_URL}/web-service/common`, {
      headers: {
        'Authorization': `Bearer ${PERSIANAPI_KEY}`,
      },
      params: {
        limit: 100, // Get more items to see what's available
        page: 1,
      },
      timeout: 15000,
    });

    console.log('✅ SUCCESS\n');

    const data = response.data?.result?.data || response.data?.data || response.data;

    if (Array.isArray(data)) {
      console.log(`Found ${data.length} total items\n`);

      // Group by category to understand the data structure
      const categories = new Map<string, any[]>();

      data.forEach((item: any) => {
        const category = item.Category || item.category || 'Unknown';
        if (!categories.has(category)) {
          categories.set(category, []);
        }
        categories.get(category)!.push(item);
      });

      console.log(`Found ${categories.size} different categories:\n`);
      console.log('='.repeat(80) + '\n');

      // Display each category with sample items
      Array.from(categories.entries()).forEach(([category, items]) => {
        console.log(`📊 Category: ${category}`);
        console.log(`   Items count: ${items.length}`);
        console.log('   Sample items:');

        items.slice(0, 3).forEach((item: any, index: number) => {
          const title = item.Title || item.عنوان || item.title || 'N/A';
          const price = item.Price || item.قیمت || item.price || 'N/A';
          const key = item.Key || item.key || 'N/A';

          console.log(`   ${index + 1}. ${title} (${key})`);
          console.log(`      Price: ${price}`);

          // Check if it looks like what we need
          if (title.includes('/')) {
            console.log(`      ⚠️  FOREX PAIR - برابری ارزها`);
          } else if (category.includes('ارز') || category.includes('currency')) {
            console.log(`      ✅ INDIVIDUAL CURRENCY - بازار ارز (THIS IS WHAT WE NEED!)`);
          }
        });

        console.log('\n');
      });

      console.log('='.repeat(80));
      console.log('\n📋 ANALYSIS:\n');
      console.log('Based on your package:');
      console.log('  ✅ بازار ارز (Currency Market) = Individual currency prices in Rial/Toman');
      console.log('  ✅ بازار طلا (Gold Market) = Gold prices');
      console.log('  ✅ بازار سکه (Coin Market) = Coin prices');
      console.log('  ⚠️  برابری ارزها (Forex Pairs) = EUR/USD pairs (not what we need for main display)');
      console.log('\nLook for categories matching these Persian terms above.');

    } else {
      console.log('Response is not an array:', typeof data);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.response?.status || error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testCommonEndpoint();
