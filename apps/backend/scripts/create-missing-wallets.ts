/**
 * Migration Script: Create Missing Wallets
 *
 * This script creates default wallets for existing users who don't have them yet.
 * It's safe to run multiple times - it only creates wallets that don't exist.
 *
 * Usage:
 *   npm run create-wallets
 *
 * What it does:
 *   1. Connects to the database using NestJS application context
 *   2. Fetches all users from the database
 *   3. For each user, checks if they have wallets
 *   4. Creates default wallets (USD, EUR, BTC, ETH, USDT, SEKKEH) for users without wallets
 *   5. Logs progress and results
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';
import { WalletsService } from '../src/wallets/wallets.service';

async function bootstrap() {
  console.log('='.repeat(60));
  console.log('Creating Missing Wallets for Existing Users');
  console.log('='.repeat(60));
  console.log('');

  // Create application context (doesn't start HTTP server)
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const usersService = app.get(UsersService);
    const walletsService = app.get(WalletsService);

    console.log('✓ Connected to database');
    console.log('');

    // Get all users with pagination
    console.log('Fetching all users...');
    const usersList = await usersService.list(1, 100); // Max 100 users per page
    const users = usersList.items;

    console.log(`Found ${users.length} total users`);
    console.log('');

    if (users.length === 0) {
      console.log('No users found in the database.');
      console.log('');
      await app.close();
      return;
    }

    // Process each user
    let usersProcessed = 0;
    let walletsCreated = 0;
    let usersSkipped = 0;
    let errors = 0;

    for (const user of users) {
      try {
        console.log(`Processing user: ${user.email} (${user._id})`);

        // Check if user already has wallets
        const existingWallets = await walletsService.getUserWallet(user._id);

        if (existingWallets.length > 0) {
          console.log(`  ⊘ User already has ${existingWallets.length} wallet(s), skipping`);
          usersSkipped++;
        } else {
          // Create default wallets
          console.log(`  → Creating default wallets...`);
          await walletsService.createDefaultWallets(user._id);

          // Verify wallets were created
          const newWallets = await walletsService.getUserWallet(user._id);
          console.log(`  ✓ Created ${newWallets.length} wallets for ${user.email}`);

          walletsCreated += newWallets.length;
          usersProcessed++;
        }

        console.log('');
      } catch (error: any) {
        console.error(`  ✗ Error processing user ${user.email}: ${error.message}`);
        console.log('');
        errors++;
      }
    }

    // Summary
    console.log('='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total users found:           ${users.length}`);
    console.log(`Users with wallets created:  ${usersProcessed}`);
    console.log(`Users skipped (had wallets): ${usersSkipped}`);
    console.log(`Total wallets created:       ${walletsCreated}`);
    console.log(`Errors encountered:          ${errors}`);
    console.log('='.repeat(60));
    console.log('');

    if (errors > 0) {
      console.log('⚠️  Migration completed with errors. Please check the logs above.');
    } else if (usersProcessed > 0) {
      console.log('✓ Migration completed successfully!');
    } else {
      console.log('✓ No action needed - all users already have wallets.');
    }

    console.log('');
  } catch (error: any) {
    console.error('');
    console.error('✗ Fatal error during migration:');
    console.error(error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('');
    process.exit(1);
  } finally {
    // Clean up and close database connections
    await app.close();
  }
}

// Run the migration
bootstrap().catch((error) => {
  console.error('Failed to run migration:', error);
  process.exit(1);
});
