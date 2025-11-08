import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { WalletsService } from '../src/wallets/wallets.service';

async function main() {
  console.log('⚙️  Bootstrapping Nest app...');
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('✅ App context created.');

  const wallets = app.get(WalletsService);
  const userId = '64f1b1b1b1b1b1b1b1b1b1b1';

  console.log('💰 Crediting 100 USD…');
  await wallets.adjustBalance({
    userId,
    currencyType: 'fiat',
    currencyCode: 'USD',
    direction: 'credit',
    amount: '100',
    reason: 'deposit',
    idempotencyKey: 'seed-deposit-100',
  });

  console.log('💸 Debiting 30 USD…');
  await wallets.adjustBalance({
    userId,
    currencyType: 'fiat',
    currencyCode: 'USD',
    direction: 'debit',
    amount: '30',
    reason: 'withdrawal',
    idempotencyKey: 'seed-withdraw-30',
  });

  const wallet = await wallets.getUserWallet(userId);
  console.log('📊 Wallet snapshot:', wallet);

  await app.close();
  console.log('🏁 Done.');
}

main().catch((e) => {
  console.error('❌ Error in seed-wallet script:', e);
  process.exit(1);
});
