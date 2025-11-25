/**
 * OHLC Data Backfill Script
 *
 * This script backfills missing OHLC data from the Navasan/PersianAPI.
 * Run this if there are gaps in the chart data.
 *
 * Usage:
 *   npx ts-node apps/backend/scripts/backfill-ohlc.ts
 *
 * Or use the API endpoints:
 *   POST /api/ohlc/backfill-all
 *   POST /api/ohlc/backfill/:itemCode?itemType=currency&timeRange=1m
 */

import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { OHLCCollectorService } from "../src/ohlc/ohlc-collector.service";
import { OHLCManagerService } from "../src/ohlc/ohlc-manager.service";
import { Logger } from "@nestjs/common";

const logger = new Logger("BackfillScript");

async function bootstrap() {
  logger.log("Starting OHLC Backfill Script...");

  // Create NestJS application context
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });

  try {
    const ohlcCollector = app.get(OHLCCollectorService);
    const ohlcManager = app.get(OHLCManagerService);

    // Check current data status
    logger.log("Checking current data status...");

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 86400000); // Last 7 days

    // Check USD data coverage
    const usdCoverage = await ohlcManager.getDataCoverage(
      "USD_SELL",
      "currency",
      "1d",
      startDate,
      endDate,
    );

    logger.log(`USD_SELL 1d coverage: ${(usdCoverage.coverage * 100).toFixed(1)}%`);
    logger.log(`  Expected points: ${usdCoverage.expectedPoints}`);
    logger.log(`  Actual points: ${usdCoverage.actualPoints}`);
    logger.log(`  Missing periods: ${usdCoverage.missingPeriods.length}`);

    if (usdCoverage.coverage < 1) {
      logger.log("\n⚠️ Data gaps detected. Starting backfill...\n");

      // Trigger backfill for all items
      await ohlcCollector.backfillRecentData();

      logger.log("\n✅ Backfill completed!");
    } else {
      logger.log("\n✅ No data gaps detected. No backfill needed.");
    }

    // Collect current data
    logger.log("\nCollecting current minute data...");
    await ohlcCollector.collectMinuteData();
    logger.log("✅ Current data collected");

    // Trigger aggregation
    logger.log("\nAggregating timeframes...");
    await ohlcCollector.aggregateTimeframes();
    logger.log("✅ Aggregation completed");

  } catch (error) {
    logger.error("Backfill failed:", error);
    process.exit(1);
  } finally {
    await app.close();
  }

  logger.log("\n🎉 Script completed successfully!");
  process.exit(0);
}

bootstrap();
