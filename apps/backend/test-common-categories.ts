import axios from 'axios';

const PERSIANAPI_KEY = 'vfkxjvy1iuaopyzfxz61';
const BASE_URL = 'https://studio.persianapi.com/index.php';

async function testCategories() {
  console.log('🧪 Analyzing all categories from /web-service/common\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Fetch multiple pages to get all data
    let allItems: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) {
      const response = await axios.get(`${BASE_URL}/web-service/common`, {
        headers: {
          'Authorization': `Bearer ${PERSIANAPI_KEY}`,
        },
        params: {
          limit: 100,
          page,
        },
        timeout: 15000,
      });

      const items = response.data?.result?.list || [];
      allItems = allItems.concat(items);

      console.log(`Page ${page}: fetched ${items.length} items`);

      if (items.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }

    console.log(`\n✅ Total items fetched: ${allItems.length}\n`);
    console.log('='.repeat(80) + '\n');

    // Group by category
    const categories = new Map<string, any[]>();

    allItems.forEach((item: any) => {
      const category = item.Category || 'Unknown';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(item);
    });

    console.log(`Found ${categories.size} different categories:\n`);
    console.log('='.repeat(80) + '\n');

    // Display each category with analysis
    Array.from(categories.entries()).forEach(([category, items]) => {
      console.log(`📊 Category: ${category}`);
      console.log(`   Total items: ${items.length}`);
      console.log('   Sample items:');

      items.slice(0, 3).forEach((item: any, index: number) => {
        console.log(`   ${index + 1}. ${item.Title}`);
        console.log(`      Price: ${item.Price}`);
        console.log(`      Change: ${item.Change}`);
      });

      // Analysis based on package description
      if (category.includes('ارز')) {
        console.log(`   ✅ THIS IS CURRENCY DATA - We need this!`);
      } else if (category.includes('طلا')) {
        console.log(`   ✅ THIS IS GOLD DATA - We need this!`);
      } else if (category.includes('سکه')) {
        console.log(`   ✅ THIS IS COIN DATA - We need this!`);
      } else if (category.includes('بورس')) {
        console.log(`   ✅ THIS IS STOCK INDEX DATA`);
      }

      console.log('\n');
    });

    console.log('='.repeat(80));
    console.log('\n📋 PACKAGE ANALYSIS:\n');
    console.log('Your package includes:');
    console.log('  1. بازار ارز - Currency Market (Dollar, Euro, Pound, Dirham prices in Rial)');
    console.log('  2. بازار طلا - Gold Market (Gold per gram in Rial)');
    console.log('  3. بازار سکه - Coin Market (Coin prices in Rial)');
    console.log('  4. بازار فلزات گرانبها - Precious Metals (Gold ounce, Silver, Platinum)');
    console.log('  5. برابری ارزها - Currency Parity (Forex pairs like EUR/USD)');
    console.log('  6. بازار بورس - Stock Market Index');
    console.log('  7. بازار نفت - Oil Market\n');
    console.log('Look for categories matching these Persian terms above.');

  } catch (error: any) {
    console.error('❌ Error:', error.response?.status || error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2).substring(0, 500));
    }
  }
}

testCategories();
