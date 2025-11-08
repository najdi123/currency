/**
 * Manual validation test script for DTO security fixes
 *
 * This script tests the security validations added to prevent NoSQL injection
 * and ensure proper input validation for wallet DTOs.
 *
 * Run with: npx ts-node scripts/test-dto-validation.ts
 */

import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

// Import DTOs
import { GetTransactionsQueryDto } from '../src/wallets/dto/get-transactions-query.dto';
import { AdjustBalanceDto } from '../src/wallets/dto/adjust-balance.dto';

console.log('=== Testing DTO Validation Security Fixes ===\n');

// Test 1: NoSQL Injection Prevention in GetTransactionsQueryDto
async function testGetTransactionsQuery() {
  console.log('TEST 1: GetTransactionsQueryDto - NoSQL Injection Prevention');
  console.log('-----------------------------------------------------------');

  // Valid case
  const validQuery = plainToClass(GetTransactionsQueryDto, {
    currencyCode: 'USD',
    direction: 'credit',
  });
  const validErrors = await validate(validQuery);
  console.log('✓ Valid currencyCode "USD":', validErrors.length === 0 ? 'PASS' : `FAIL (${validErrors.length} errors)`);

  // NoSQL injection attempt with object
  const injectionQuery = plainToClass(GetTransactionsQueryDto, {
    currencyCode: { $ne: 'USD' },
  });
  const injectionErrors = await validate(injectionQuery);
  console.log('✓ NoSQL injection {"$ne": "USD"}:', injectionErrors.length > 0 ? 'BLOCKED ✓' : 'VULNERABLE ✗');

  // Too long currency code
  const longQuery = plainToClass(GetTransactionsQueryDto, {
    currencyCode: 'VERYLONGCURRENCY',
  });
  const longErrors = await validate(longQuery);
  console.log('✓ Too long currency code:', longErrors.length > 0 ? 'BLOCKED ✓' : 'VULNERABLE ✗');

  // Invalid characters in currency code
  const invalidCharsQuery = plainToClass(GetTransactionsQueryDto, {
    currencyCode: 'USD;DROP TABLE',
  });
  const invalidCharsErrors = await validate(invalidCharsQuery);
  console.log('✓ Invalid characters "USD;DROP TABLE":', invalidCharsErrors.length > 0 ? 'BLOCKED ✓' : 'VULNERABLE ✗');

  console.log();
}

// Test 2: Currency Code Validation in AdjustBalanceDto
async function testAdjustBalanceCurrency() {
  console.log('TEST 2: AdjustBalanceDto - Currency Code Validation');
  console.log('----------------------------------------------------');

  // Valid case
  const validDto = plainToClass(AdjustBalanceDto, {
    currencyType: 'fiat',
    currencyCode: 'USD',
    direction: 'credit',
    amount: '100.50',
    reason: 'deposit',
  });
  const validErrors = await validate(validDto);
  console.log('✓ Valid currency code "USD":', validErrors.length === 0 ? 'PASS' : `FAIL (${validErrors.length} errors)`);

  // Too long
  const longDto = plainToClass(AdjustBalanceDto, {
    currencyType: 'fiat',
    currencyCode: 'VERYLONGCURRENCY',
    direction: 'credit',
    amount: '100.50',
    reason: 'deposit',
  });
  const longErrors = await validate(longDto);
  console.log('✓ Too long currency code:', longErrors.length > 0 ? 'BLOCKED ✓' : 'VULNERABLE ✗');

  // Invalid characters
  const invalidDto = plainToClass(AdjustBalanceDto, {
    currencyType: 'fiat',
    currencyCode: 'USD<script>',
    direction: 'credit',
    amount: '100.50',
    reason: 'deposit',
  });
  const invalidErrors = await validate(invalidDto);
  console.log('✓ Invalid characters in code:', invalidErrors.length > 0 ? 'BLOCKED ✓' : 'VULNERABLE ✗');

  console.log();
}

// Test 3: Amount Validation
async function testAmountValidation() {
  console.log('TEST 3: AdjustBalanceDto - Amount Validation');
  console.log('---------------------------------------------');

  // Valid amounts
  const validCases = ['100', '100.5', '100.12345678'];
  for (const amount of validCases) {
    const dto = plainToClass(AdjustBalanceDto, {
      currencyType: 'crypto',
      currencyCode: 'BTC',
      direction: 'credit',
      amount,
      reason: 'deposit',
    });
    const errors = await validate(dto);
    console.log(`✓ Valid amount "${amount}":`, errors.length === 0 ? 'PASS' : 'FAIL');
  }

  // Invalid: too many decimals
  const tooManyDecimals = plainToClass(AdjustBalanceDto, {
    currencyType: 'crypto',
    currencyCode: 'BTC',
    direction: 'credit',
    amount: '100.123456789',
    reason: 'deposit',
  });
  const decimalErrors = await validate(tooManyDecimals);
  console.log('✓ Too many decimals (9):', decimalErrors.length > 0 ? 'BLOCKED ✓' : 'VULNERABLE ✗');

  // Invalid: too long
  const tooLong = plainToClass(AdjustBalanceDto, {
    currencyType: 'crypto',
    currencyCode: 'BTC',
    direction: 'credit',
    amount: '123456789012345678901',
    reason: 'deposit',
  });
  const lengthErrors = await validate(tooLong);
  console.log('✓ Excessively long amount:', lengthErrors.length > 0 ? 'BLOCKED ✓' : 'VULNERABLE ✗');

  // Invalid: negative (regex doesn't allow -)
  const negative = plainToClass(AdjustBalanceDto, {
    currencyType: 'crypto',
    currencyCode: 'BTC',
    direction: 'credit',
    amount: '-100',
    reason: 'deposit',
  });
  const negativeErrors = await validate(negative);
  console.log('✓ Negative amount:', negativeErrors.length > 0 ? 'BLOCKED ✓' : 'VULNERABLE ✗');

  console.log();
}

// Test 4: RequestId and IdempotencyKey Validation
async function testOptionalFields() {
  console.log('TEST 4: AdjustBalanceDto - Optional Fields Validation');
  console.log('------------------------------------------------------');

  // Valid MongoDB ObjectId
  const validId = plainToClass(AdjustBalanceDto, {
    currencyType: 'fiat',
    currencyCode: 'USD',
    direction: 'credit',
    amount: '100',
    reason: 'deposit',
    requestId: '507f1f77bcf86cd799439011',
  });
  const validIdErrors = await validate(validId);
  console.log('✓ Valid MongoDB ObjectId:', validIdErrors.length === 0 ? 'PASS' : 'FAIL');

  // Invalid ObjectId
  const invalidId = plainToClass(AdjustBalanceDto, {
    currencyType: 'fiat',
    currencyCode: 'USD',
    direction: 'credit',
    amount: '100',
    reason: 'deposit',
    requestId: 'not-a-valid-objectid',
  });
  const invalidIdErrors = await validate(invalidId);
  console.log('✓ Invalid requestId format:', invalidIdErrors.length > 0 ? 'BLOCKED ✓' : 'VULNERABLE ✗');

  // Valid idempotency key
  const validKey = plainToClass(AdjustBalanceDto, {
    currencyType: 'fiat',
    currencyCode: 'USD',
    direction: 'credit',
    amount: '100',
    reason: 'deposit',
    idempotencyKey: 'user-123-deposit-001',
  });
  const validKeyErrors = await validate(validKey);
  console.log('✓ Valid idempotency key:', validKeyErrors.length === 0 ? 'PASS' : 'FAIL');

  // Too long idempotency key
  const longKey = plainToClass(AdjustBalanceDto, {
    currencyType: 'fiat',
    currencyCode: 'USD',
    direction: 'credit',
    amount: '100',
    reason: 'deposit',
    idempotencyKey: 'a'.repeat(101),
  });
  const longKeyErrors = await validate(longKey);
  console.log('✓ Too long idempotency key:', longKeyErrors.length > 0 ? 'BLOCKED ✓' : 'VULNERABLE ✗');

  // Invalid characters in idempotency key
  const invalidKey = plainToClass(AdjustBalanceDto, {
    currencyType: 'fiat',
    currencyCode: 'USD',
    direction: 'credit',
    amount: '100',
    reason: 'deposit',
    idempotencyKey: 'key$with@special',
  });
  const invalidKeyErrors = await validate(invalidKey);
  console.log('✓ Invalid chars in key:', invalidKeyErrors.length > 0 ? 'BLOCKED ✓' : 'VULNERABLE ✗');

  console.log();
}

// Run all tests
async function runTests() {
  await testGetTransactionsQuery();
  await testAdjustBalanceCurrency();
  await testAmountValidation();
  await testOptionalFields();

  console.log('=== All Security Validation Tests Complete ===');
}

runTests().catch(console.error);
