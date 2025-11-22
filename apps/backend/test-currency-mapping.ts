import axios from 'axios';

const PERSIANAPI_KEY = 'vfkxjvy1iuaopyzfxz61';
const BASE_URL = 'https://studio.persianapi.com/web-service';

// Test currency code generation
function generateCurrencyCode(title: string, category?: string): string {
  const currencyMap: Record<string, string> = {
    'دلار استرالیا': 'aud',
    'دلار سنگاپور': 'sgd',
    'دلار کانادا': 'cad',
    'دلار هنگ کنگ': 'hkd',
    'دلار نیوزلند': 'nzd',
    'دلار آمریکا': 'usd',
    'دلار': 'usd',
    'پوند انگلیس': 'gbp',
    'پوند': 'gbp',
    'یورو': 'eur',
    'ین ژاپن': 'jpy',
    'ین': 'jpy',
    'یوان چین': 'cny',
    'یوان': 'cny',
    'روبل روسیه': 'rub',
    'روبل': 'rub',
    'لیره ترکیه': 'try',
    'لیره': 'try',
    'روپیه هند': 'inr',
    'روپیه پاکستان': 'pkr',
    'روپیه': 'inr',
    'ریال عربستان': 'sar',
    'ریال قطر': 'qar',
    'ریال عمان': 'omr',
    'ریال': 'sar',
    'درهم امارات': 'aed',
    'درهم': 'aed',
    'دینار کویت': 'kwd',
    'دینار عراق': 'iqd',
    'دینار بحرین': 'bhd',
    'دینار اردن': 'jod',
    'دینار': 'kwd',
    'کرون دانمارک': 'dkk',
    'کرون سوئد': 'sek',
    'کرون نروژ': 'nok',
    'کرون': 'sek',
    'فرانک سوئیس': 'chf',
    'فرانک': 'chf',
    'بات تایلند': 'thb',
    'بات': 'thb',
    'رینگیت مالزی': 'myr',
    'رینگیت': 'myr',
    'وون کره جنوبی': 'krw',
    'پزو مکزیک': 'mxn',
    'رند آفریقای جنوبی': 'zar',
  };

  const isBuy = category?.includes('تقاضا');
  const isSell = category?.includes('عرضه');
  const suffix = isBuy ? '_buy' : isSell ? '_sell' : '';

  const findCurrencyCode = (text: string): string => {
    const sortedEntries = Object.entries(currencyMap).sort((a, b) => b[0].length - a[0].length);
    for (const [persian, english] of sortedEntries) {
      if (text.includes(persian)) {
        return english;
      }
    }
    return text.substring(0, 3).toLowerCase();
  };

  const parts = title.split('/').map(p => p.trim());

  if (parts.length === 2) {
    const firstCurrency = findCurrencyCode(parts[0]);
    const secondCurrency = findCurrencyCode(parts[1]);
    return `${firstCurrency}_${secondCurrency}${suffix}`;
  }

  const currencyCode = findCurrencyCode(title);
  if (currencyCode !== title.substring(0, 3).toLowerCase()) {
    return `${currencyCode}${suffix}`;
  }

  return title.substring(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase() + suffix;
}

async function testCurrencyMapping() {
  console.log('🧪 Testing Currency Code Generation\n');

  try {
    const response = await axios.get(`${BASE_URL}/common/forex`, {
      headers: {
        'Authorization': `Bearer ${PERSIANAPI_KEY}`,
      },
      params: {
        limit: 10,
      },
    });

    const items = response.data?.result?.data || [];

    console.log(`Fetched ${items.length} currency items\n`);
    console.log('Sample Currency Code Mappings:');
    console.log('='.repeat(80));

    items.slice(0, 10).forEach((item: any) => {
      const code = generateCurrencyCode(item.عنوان, item.category);
      console.log(`${item.عنوان.padEnd(30)} | ${item.category.padEnd(30)} | ${code}`);
    });

    console.log('\n✅ Currency code generation working correctly!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testCurrencyMapping();
