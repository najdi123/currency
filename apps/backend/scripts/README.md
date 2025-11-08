# Backend Scripts

This directory contains utility scripts for database management and one-time operations.

## Available Scripts

### 1. Seed Admin User

**Script**: `seed-admin.ts`
**Command**: `npm run seed:admin`

Creates an initial admin user in the database for first-time setup.

**Usage**:
```bash
cd apps/backend
npm run seed:admin
```

**Credentials** (default):
- Email: `admin@example.com`
- Password: `Admin123!`

**Note**: This script is idempotent - it will skip creation if an admin already exists.

---

### 2. Create Missing Wallets

**Script**: `create-missing-wallets.ts`
**Command**: `npm run create-wallets`

Creates default wallets for existing users who don't have them yet. This is useful after implementing the automatic wallet creation feature to backfill existing users.

**Usage**:
```bash
cd apps/backend
npm run create-wallets
```

**What it does**:
1. Connects to the database
2. Fetches all users
3. For each user without wallets, creates default wallets with 0 balance
4. Provides a detailed summary of actions taken

**Default Wallets Created**:
- **Fiat Currencies**: USD, EUR
- **Cryptocurrencies**: BTC, ETH, USDT
- **Gold**: SEKKEH

**Safety**:
- Safe to run multiple times - only creates wallets that don't exist
- Uses `insertMany` with `ordered: false` to handle duplicate key errors gracefully
- Logs all actions for audit purposes

**Example Output**:
```
============================================================
Creating Missing Wallets for Existing Users
============================================================

✓ Connected to database

Fetching all users...
Found 5 total users

Processing user: user1@example.com (65a1b2c3d4e5f6789abcdef0)
  → Creating default wallets...
  ✓ Created 6 wallets for user1@example.com

Processing user: user2@example.com (65a1b2c3d4e5f6789abcdef1)
  ⊘ User already has 6 wallet(s), skipping

============================================================
Migration Summary
============================================================
Total users found:           5
Users with wallets created:  3
Users skipped (had wallets): 2
Total wallets created:       18
Errors encountered:          0
============================================================

✓ Migration completed successfully!
```

---

## Development Notes

### Prerequisites

All scripts require:
1. A valid MongoDB connection (configured in `.env`)
2. The backend dependencies installed (`npm install`)
3. Proper environment variables set

### Adding New Scripts

When adding new scripts:

1. Create the script in `apps/backend/scripts/`
2. Import `dotenv/config` at the top for environment variable access
3. Use `NestFactory.createApplicationContext()` to access services
4. Always close the application context when done
5. Add error handling and informative logging
6. Update this README with documentation
7. Add the script to `package.json` scripts section

**Example**:
```typescript
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    // Your logic here
  } finally {
    await app.close();
  }
}

main().catch(console.error);
```

### Running Scripts

All scripts should be run from the `apps/backend` directory:

```bash
cd apps/backend
npm run <script-name>
```

### Troubleshooting

**Issue**: Script can't connect to database
**Solution**: Verify `MONGODB_URI` in `.env` file is correct

**Issue**: Module not found errors
**Solution**: Run `npm install` in `apps/backend` directory

**Issue**: Permission denied
**Solution**: Ensure database user has proper permissions for the operations

---

## Security Notes

- Never commit sensitive credentials or API keys
- Use environment variables for all configuration
- Review script output before running in production
- Take database backups before running migration scripts
- Test scripts in development environment first
