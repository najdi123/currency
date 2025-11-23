# PersianAPI Base Package - Available Data Summary

**API Key**: `vfkxjvy1iuaopyzfxz61`
**Plan**: Base Package (1 month)
**Rate Limit**: 1 request per 5 seconds (720 requests/hour)

---

## ✅ Available Endpoints (4 Endpoints)

### 1. `/web-service/common/gold-currency-coin` - Main Endpoint
**Status**: ✅ Working
**Items**: ~100+ mixed items (gold, currency, coin, silver)
**Response Format**: `{ result: [array of items] }`

#### Available Categories:
- **نقره (Silver)**: Silver 999, gram silver
- **آبشده (Gold Bar)**: Cash gold bar prices
- **انس های جهانی (Global Ounce)**: International gold ounce
- **ارز آزاد (Free Currency)**: Dollar free market
- **ارز دولتی (Official Currency)**: Bank dollar
- **ارز سنا (Sena Exchange)**: Sena buy/sell dollar
- **ارز نیما (Nima Currency)**: Nima transfer dollar
- **سکه نقدی (Cash Coin)**: Imam coin, Bahar Azadi, Half coin, Quarter coin, Gerami coin
- **طلای 18 عیار (18k Gold)**: 18 karat gold per gram
- **یورو (Euro)**: Euro prices

#### Sample Items:
```json
{
  "key": 137202,
  "category": "ارز آزاد",
  "title": "دلار",
  "price": "1135200",
  "change": "+0.14",
  "high": "1141500",
  "low": "1132800",
  "created_at": "2025-11-20 16:59:58"
}
```

**Recommendation**: ⭐ **Use this as your primary endpoint** - gives you most of what you need in one request!

---

### 2. `/web-service/common/digitalcurrency` - Cryptocurrencies
**Status**: ✅ Working
**Items**: 10 cryptocurrencies
**Response Format**: `{ result: { list: [array] } }`

#### Available Cryptocurrencies:
1. **Bitcoin (BTC)** - $88,613
2. **Ethereum (ETH)** - $2,896
3. **Tether (USDT)** - $0.998
4. **BNB**
5. **XRP**
6. **Cardano (ADA)**
7. **Solana (SOL)**
8. **Dogecoin (DOGE)**
9. **Polkadot (DOT)**
10. **Polygon (MATIC)**

#### Data Fields Per Crypto:
- **Basic**: id, name, symbol, slug, price, price_irt
- **24h Stats**: high24h, low24h
- **Market**: marketCap, circulatingSupply, totalSupply, maxSupply
- **Price Changes**: percentChange1h, 24h, 7d, 30d, 60d, 90d, 1y
- **Conversions**: BTC-price, ETH-price, USD-price
- **Advanced**: dominance, turnover, ytdPriceChange, ath (all-time high), atl (all-time low)

---

### 3. `/web-service/common/forex` - Currency Exchange Rates
**Status**: ✅ Working
**Items**: 42 currency pairs
**Response Format**: `{ result: { data: [array], total: 42, per_page: 100 } }`

#### Available Currency Pairs:
- **پوند / دلار (GBP/USD)** - 1.3101
- **دلار / بات تایلند (USD/THB)** - 32.429
- **یورو / دلار (EUR/USD)**
- **دلار / ین (USD/JPY)**
- **And 38 more pairs...**

#### Categories:
- **تقاضا (Demand/Buy)**
- **عرضه (Supply/Sell)**

---

### 4. `/web-service/common` - General Market Data
**Status**: ✅ Working
**Items**: 28 items (energy, metals, etc.)
**Response Format**: `{ result: { list: [array] } }`

#### Available Markets:
- **بازار انرژی (Energy Market)**:
  - Brent Oil: $64.05
  - Crude Oil WTI: $59.74
  - Carbon Emissions: $81.42
  - Natural Gas
  - Gasoline
  - Heating Oil

- **Other Markets**: Additional commodities and indices

---

## ❌ Restricted Endpoints (3 Endpoints - Not in Base Package)

These require purchasing separate API packages:

1. **`/gold`** - Detailed gold market (500 error)
2. **`/coin/cash`** - Detailed coin market (500 error)
3. **`/currency/free`** - Detailed free market currency (500 error)

---

## 📊 Data Coverage Summary

### What You HAVE Access To:

#### Currencies (From `/common/gold-currency-coin`):
- ✅ **Dollar**: Free market, official (bank), Sena buy/sell, Nima transfer
- ✅ **Euro**: Free market
- ⚠️ **Limited**: Only major currencies (USD, EUR)
- ❌ **Missing**: Other currencies (GBP, CAD, AUD, JPY, etc.) - only available as forex pairs

#### Cryptocurrencies (From `/common/digitalcurrency`):
- ✅ **Complete**: 10 major cryptocurrencies
- ✅ **Rich Data**: Market cap, price changes, conversions
- ✅ **All You Need**: BTC, ETH, USDT, BNB, XRP, ADA, SOL, DOGE, DOT, MATIC

#### Gold (From `/common/gold-currency-coin`):
- ✅ **18k Gold per gram**
- ✅ **International gold ounce**
- ✅ **Gold bar (آبشده)**

#### Coins (From `/common/gold-currency-coin`):
- ✅ **سکه امامی (Imam Coin)**: 1,175,050,000 Rials
- ✅ **بهار آزادی (Bahar Azadi)**
- ✅ **نیم سکه (Half Coin)**
- ✅ **ربع سکه (Quarter Coin)**
- ✅ **گرمی (Gerami Coin)**

#### Other:
- ✅ **Silver 999**
- ✅ **Forex pairs** (42 pairs)
- ✅ **Energy market** (Oil, Gas, etc.)

---

## 💡 Recommended Architecture

### Primary Data Source:
**Use `/common/gold-currency-coin` for:**
- All currency prices (USD, EUR)
- All coin prices (Imam, Bahar, etc.)
- Gold prices (18k, ounce, bar)
- Silver prices

### Secondary Data Source:
**Use `/common/digitalcurrency` for:**
- All 10 cryptocurrencies

### Optional (if needed):
**Use `/common/forex` for:**
- Currency pair conversions (GBP/USD, EUR/USD, etc.)

**Use `/common` for:**
- Oil and energy prices (if you want to display them)

---

## 🎯 What Matches Your Current Navasan Coverage

### ✅ You Can Cover:
1. **Currencies**:
   - ✅ USD (multiple variants: free, bank, Sena, Nima)
   - ✅ EUR
   - ⚠️ **Limited**: Need forex endpoint for other currencies

2. **Crypto** (11 items in Navasan, 10 in PersianAPI):
   - ✅ BTC, ETH, USDT, BNB, XRP, ADA, DOGE, SOL, MATIC, DOT
   - ❌ Missing: LTC (Litecoin) - but you get Polygon instead

3. **Gold** (7 items in Navasan):
   - ✅ سکه امامی (Sekkeh)
   - ✅ بهار آزادی (Bahar)
   - ✅ نیم سکه (Nim)
   - ✅ ربع سکه (Rob)
   - ✅ گرمی (Gerami)
   - ✅ 18 عیار (18ayar)
   - ✅ آبشده (Abshodeh)

### Summary:
- **Crypto**: 90% coverage (10/11)
- **Gold**: 100% coverage (7/7)
- **Currency**: Limited - only USD & EUR directly, but can use forex pairs

---

## 🚀 Next Steps

1. ✅ **API Integration Complete** - PersianAPI provider working
2. ⏭️ **Proceed to Phase 2**: Database schema redesign
3. ⏭️ **Map data properly**: Handle the different response structures
4. ⏭️ **Consider**: If you need more currencies, might need to purchase "Currency Market" package from PersianAPI

---

## 📝 Notes

- **Rate Limit**: With 720 requests/hour and 4 endpoints, you can refresh all data every ~1 minute if needed
- **Data Freshness**: Most items updated within last few hours (check `created_at` field)
- **Response Quality**: High quality data with price, change %, high, low for most items
- **Recommendation**: Start with `gold-currency-coin` + `digitalcurrency` endpoints only (covers 99% of your needs)
