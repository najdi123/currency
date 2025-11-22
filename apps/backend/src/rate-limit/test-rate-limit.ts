#!/usr/bin/env ts-node

import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { RateLimitModule } from "./rate-limit.module";
import { RateLimitService } from "./rate-limit.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || ""),
    RateLimitModule,
  ],
})
class TestModule {}

async function testRateLimiting() {
  console.log("🧪 Testing Rate Limiting System (2-hour window)");
  console.log("=".repeat(60));
  console.log("System: 20 requests per 2-hour window");
  console.log("=".repeat(60));

  const app = await NestFactory.createApplicationContext(TestModule);
  const rateLimitService = app.get(RateLimitService);

  const testIdentifier = "test-user-123";
  let passedTests = 0;
  let totalTests = 0;

  // Test 1: First request should be allowed
  console.log("\n1️⃣  Test: First request should be allowed");
  totalTests++;
  try {
    const result1 = await rateLimitService.checkAndConsumeQuota(testIdentifier);
    if (result1.allowed && result1.remaining === 19) {
      console.log("   ✅ PASSED - Request allowed, 19 remaining");
      passedTests++;
    } else {
      console.log("   ❌ FAILED -", result1);
    }
  } catch (error: any) {
    console.log("   ❌ ERROR -", error.message);
  }

  // Test 2: Second request should decrement counter
  console.log("\n2️⃣  Test: Second request decrements counter");
  totalTests++;
  try {
    const result2 = await rateLimitService.checkAndConsumeQuota(testIdentifier);
    if (result2.allowed && result2.remaining === 18) {
      console.log("   ✅ PASSED - Request allowed, 18 remaining");
      passedTests++;
    } else {
      console.log("   ❌ FAILED -", result2);
    }
  } catch (error: any) {
    console.log("   ❌ ERROR -", error.message);
  }

  // Test 3: Status check should not increment
  console.log("\n3️⃣  Test: Status check does not increment counter");
  totalTests++;
  try {
    const status = await rateLimitService.getRateLimitStatus(testIdentifier);
    if (status.remaining === 18) {
      console.log("   ✅ PASSED - Status check did not increment");
      passedTests++;
    } else {
      console.log(
        "   ❌ FAILED - Remaining:",
        status.remaining,
        "(expected 18)",
      );
    }
  } catch (error: any) {
    console.log("   ❌ ERROR -", error.message);
  }

  // Test 4: Window information is present
  console.log("\n4️⃣  Test: Window boundaries are returned");
  totalTests++;
  try {
    const status = await rateLimitService.getRateLimitStatus(testIdentifier);
    if (status.windowStart && status.windowEnd) {
      const windowDuration =
        (status.windowEnd.getTime() - status.windowStart.getTime()) /
        (60 * 60 * 1000);
      console.log(`   ✅ PASSED - Window: ${windowDuration} hours`);
      passedTests++;
    } else {
      console.log("   ❌ FAILED - Missing window boundaries");
    }
  } catch (error: any) {
    console.log("   ❌ ERROR -", error.message);
  }

  // Test 5: Different user has separate limit
  console.log("\n5️⃣  Test: Different users have separate limits");
  totalTests++;
  try {
    const result = await rateLimitService.checkAndConsumeQuota("test-user-456");
    if (result.allowed && result.remaining === 19) {
      console.log("   ✅ PASSED - New user has fresh limit (19 remaining)");
      passedTests++;
    } else {
      console.log("   ❌ FAILED -", result);
    }
  } catch (error: any) {
    console.log("   ❌ ERROR -", error.message);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}`);
  console.log(
    `Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`,
  );

  if (passedTests === totalTests) {
    console.log("✅ ALL TESTS PASSED!");
  } else {
    console.log("⚠️  SOME TESTS FAILED");
  }

  await app.close();
  process.exit(passedTests === totalTests ? 0 : 1);
}

testRateLimiting().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
