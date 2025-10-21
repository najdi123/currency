# Currency Tracker Monorepo

A comprehensive currency tracking application with prices displayed in Iranian Toman (IRR). This monorepo includes a NestJS backend API and a placeholder for a Next.js frontend.

## Project Structure

```
currency/
├── apps/
│   ├── backend/          # NestJS API application
│   │   ├── src/
│   │   │   ├── currencies/           # Fiat currencies module
│   │   │   ├── digital-currencies/   # Cryptocurrencies module
│   │   │   ├── gold/                 # Gold prices module
│   │   │   ├── app.module.ts
│   │   │   ├── app.controller.ts
│   │   │   ├── app.service.ts
│   │   │   └── main.ts
│   │   ├── .env                      # Environment variables
│   │   ├── .env.example              # Environment template
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── nest-cli.json
│   └── frontend/         # Next.js application (to be installed)
├── package.json          # Root workspace configuration
├── .gitignore
└── README.md
```

## Features

### Backend API

The backend provides three main modules, all with prices in Iranian Toman:

1. **Currencies Module** (`/api/currencies`)
   - Track fiat currencies (USD, EUR, GBP, etc.)
   - CRUD operations for currency management
   - Price tracking with 24-hour change data
   - Filter active currencies

2. **Digital Currencies Module** (`/api/digital-currencies`)
   - Track cryptocurrencies (BTC, ETH, USDT, etc.)
   - Market cap and trading volume data
   - Top cryptocurrencies by market cap
   - 24-hour and 7-day price changes

3. **Gold Module** (`/api/gold`)
   - Track different gold types (24K, 18K, coins, bars)
   - Price per gram or unit
   - Purity tracking
   - Price change monitoring

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (running locally or remote)
- npm or yarn

### Installation

1. **Install dependencies for the entire monorepo:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**

   Copy the example env file and update it with your MongoDB connection:
   ```bash
   cd apps/backend
   cp .env.example .env
   ```

   Update the `.env` file with your MongoDB URI:
   ```env
   MONGODB_URI=mongodb://localhost:27017/currency-tracker
   PORT=4000
   FRONTEND_URL=http://localhost:3000
   ```

3. **Start MongoDB:**

   Make sure MongoDB is running on your system. If using Docker:
   ```bash
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

### Running the Application

**Start the backend in development mode:**
```bash
npm run backend:dev
```

The API will be available at: `http://localhost:4000/api`

**Health check endpoint:**
```bash
curl http://localhost:4000/api/health
```

### API Endpoints

#### Currencies (Fiat)
- `GET /api/currencies` - Get all currencies
- `GET /api/currencies?active=true` - Get active currencies only
- `GET /api/currencies/:id` - Get currency by ID
- `GET /api/currencies/code/:code` - Get currency by code (e.g., USD)
- `POST /api/currencies` - Create new currency
- `PATCH /api/currencies/:id` - Update currency
- `DELETE /api/currencies/:id` - Delete currency

#### Digital Currencies (Crypto)
- `GET /api/digital-currencies` - Get all digital currencies
- `GET /api/digital-currencies?active=true` - Get active currencies only
- `GET /api/digital-currencies/top?limit=10` - Get top by market cap
- `GET /api/digital-currencies/:id` - Get digital currency by ID
- `GET /api/digital-currencies/symbol/:symbol` - Get by symbol (e.g., BTC)
- `POST /api/digital-currencies` - Create new digital currency
- `PATCH /api/digital-currencies/:id` - Update digital currency
- `DELETE /api/digital-currencies/:id` - Delete digital currency

#### Gold
- `GET /api/gold` - Get all gold types
- `GET /api/gold?active=true` - Get active gold types only
- `GET /api/gold/:id` - Get gold type by ID
- `GET /api/gold/type/:type` - Get by type (e.g., 24K)
- `GET /api/gold/purity/:minPurity` - Get by minimum purity
- `POST /api/gold` - Create new gold type
- `PATCH /api/gold/:id` - Update gold type
- `DELETE /api/gold/:id` - Delete gold type

### Example API Usage

**Create a fiat currency:**
```bash
curl -X POST http://localhost:4000/api/currencies \
  -H "Content-Type: application/json" \
  -d '{
    "code": "USD",
    "name": "US Dollar",
    "symbol": "$",
    "priceInToman": 580000,
    "changePercentage24h": 1.5
  }'
```

**Create a cryptocurrency:**
```bash
curl -X POST http://localhost:4000/api/digital-currencies \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC",
    "name": "Bitcoin",
    "priceInToman": 25000000000,
    "marketCapInToman": 500000000000000,
    "changePercentage24h": 2.3
  }'
```

**Create a gold type:**
```bash
curl -X POST http://localhost:4000/api/gold \
  -H "Content-Type: application/json" \
  -d '{
    "type": "24K",
    "name": "24 Karat Gold",
    "priceInToman": 35000000,
    "unit": "gram",
    "purity": 99.9
  }'
```

## Frontend Setup (Next.js)

The frontend folder is empty and ready for you to install Next.js manually:

```bash
cd apps/frontend
npx create-next-app@latest . --typescript --tailwind --app
```

## Development Scripts

From the root directory:

- `npm run backend:dev` - Start backend in development mode
- `npm run backend:build` - Build backend for production
- `npm run backend:start` - Start backend in production mode

## Technology Stack

### Backend
- NestJS - Progressive Node.js framework
- MongoDB - NoSQL database
- Mongoose - MongoDB ODM
- TypeScript - Type-safe JavaScript
- Class Validator - DTO validation
- Class Transformer - Object transformation

### Key Features
- Global CORS configuration
- Environment-based configuration
- Global validation pipes
- RESTful API architecture
- Modular structure
- All prices in Iranian Toman (IRR)

## Notes

- All monetary values are stored and displayed in Iranian Toman (IRR)
- CORS is configured to allow frontend integration
- MongoDB connection is required for the backend to function
- Environment variables must be configured before running

## License

ISC
