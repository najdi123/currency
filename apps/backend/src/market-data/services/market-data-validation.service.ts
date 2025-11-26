import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  VALIDATION,
  VALID_CATEGORIES,
  ERROR_MESSAGES,
  ItemCategory,
} from '../constants/market-data.constants';
import { MarketDataResponse, PriceItem, ValidationResult } from '../types/market-data.types';

/**
 * MarketDataValidationService
 *
 * Responsible for all input validation and security checks
 * - Validates category parameters
 * - Validates URLs (SSRF prevention)
 * - Validates date ranges
 * - Validates API responses
 * - Sanitizes error messages
 */
@Injectable()
export class MarketDataValidationService {
  private readonly logger = new Logger(MarketDataValidationService.name);

  /**
   * Validate category parameter to prevent NoSQL injection
   * Only allows alphanumeric characters, underscores, hyphens, and reasonable length
   *
   * @throws BadRequestException if category is invalid
   */
  validateCategory(category: string): void {
    if (!category || typeof category !== 'string') {
      throw new BadRequestException('Category must be a non-empty string');
    }

    if (category.length > VALIDATION.MAX_CATEGORY_LENGTH) {
      throw new BadRequestException(ERROR_MESSAGES.CATEGORY_TOO_LONG);
    }

    if (!VALIDATION.SAFE_CATEGORY_PATTERN.test(category)) {
      throw new BadRequestException(ERROR_MESSAGES.CATEGORY_INVALID_CHARS);
    }
  }

  /**
   * Validate that category is a known category
   */
  validateKnownCategory(category: string): void {
    this.validateCategory(category);

    if (!VALID_CATEGORIES.includes(category as ItemCategory)) {
      throw new BadRequestException(
        `Invalid category: ${category}. Valid categories are: ${VALID_CATEGORIES.join(', ')}`,
      );
    }
  }

  /**
   * Validate internal API URL to prevent SSRF attacks
   * Only allows localhost URLs with http/https protocols
   *
   * @throws Error if URL is invalid
   */
  validateInternalApiUrl(url: string): void {
    try {
      const parsed = new URL(url);

      // Only allow localhost for security
      const allowedHosts = ['localhost', '127.0.0.1', '::1'];
      if (!allowedHosts.includes(parsed.hostname)) {
        throw new Error(
          `INTERNAL_API_URL must point to localhost, got: ${parsed.hostname}`,
        );
      }

      // Only allow http/https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(
          `INTERNAL_API_URL must use http or https protocol, got: ${parsed.protocol}`,
        );
      }

      this.logger.log(`Internal API URL validated: ${url}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('INTERNAL_API_URL')) {
        throw error;
      }
      this.logger.error(
        `Invalid INTERNAL_API_URL: ${url} - ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(`Invalid URL format: ${url}`);
    }
  }

  /**
   * Validate date range for historical data queries
   *
   * @throws BadRequestException if date is invalid
   */
  validateDateRange(targetDate: Date): void {
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    if (targetDate.getTime() > today.getTime()) {
      throw new BadRequestException(ERROR_MESSAGES.FUTURE_DATE);
    }

    // Check if date is within allowed history range
    const maxHistoryDate = new Date();
    maxHistoryDate.setDate(maxHistoryDate.getDate() - VALIDATION.MAX_DAYS_HISTORY);

    if (targetDate.getTime() < maxHistoryDate.getTime()) {
      throw new BadRequestException(
        `Date is too old. Maximum history is ${VALIDATION.MAX_DAYS_HISTORY} days.`,
      );
    }
  }

  /**
   * Validate API response structure
   * Updated to work with dynamic currency codes from API providers
   */
  validateApiResponse(data: unknown, items: string): ValidationResult {
    const errors: string[] = [];

    // Check that response data exists and is an object
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      errors.push('Invalid API response: data is not an object');
      return { isValid: false, errors };
    }

    const responseData = data as Record<string, unknown>;

    // Check that response has some data
    const keys = Object.keys(responseData);
    if (keys.length === 0) {
      errors.push('API response is empty');
      return { isValid: false, errors };
    }

    // Validate structure of each field in the response
    for (const key of keys) {
      // Skip metadata keys
      if (key.startsWith('_')) continue;

      const fieldData = responseData[key];

      // Validate that the field contains an object with required properties
      if (
        !fieldData ||
        typeof fieldData !== 'object' ||
        Array.isArray(fieldData)
      ) {
        errors.push(`Invalid structure for field "${key}"`);
        continue;
      }

      // Validate that the field object contains 'value' property
      const fieldObject = fieldData as Record<string, unknown>;
      if (!('value' in fieldObject)) {
        errors.push(`Missing "value" property in field "${key}"`);
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    this.logger.log(
      `API response validation passed: ${keys.length} items received`,
    );
    return { isValid: true };
  }

  /**
   * Validate API response and throw if invalid
   *
   * @throws Error if response is invalid
   */
  validateApiResponseOrThrow(data: unknown, items: string): void {
    const result = this.validateApiResponse(data, items);

    if (!result.isValid) {
      const errorMessage = result.errors?.join('; ') || 'Invalid API response';
      this.logger.error(`API response validation failed: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  /**
   * Type guard to validate data is a valid MarketDataResponse
   */
  isValidMarketData(data: unknown): data is MarketDataResponse {
    if (typeof data !== 'object' || data === null) return false;
    if (Array.isArray(data)) return false;
    return true;
  }

  /**
   * Validate price item structure
   */
  isValidPriceItem(item: unknown): item is PriceItem {
    if (!item || typeof item !== 'object') return false;

    const obj = item as Record<string, unknown>;
    return 'value' in obj && (typeof obj.value === 'string' || typeof obj.value === 'number');
  }

  /**
   * Sanitize error message to remove sensitive data
   */
  sanitizeErrorMessage(error: unknown): string {
    const err = error as Error | { message?: string };
    let message = err?.message || String(error);

    // Remove URLs
    message = message.replace(/https?:\/\/[^\s]+/g, '[URL]');

    // Remove API keys
    message = message.replace(/api[_-]?key[=:]\s*[\w-]+/gi, 'api_key=[REDACTED]');

    // Remove tokens
    message = message.replace(/token[=:]\s*[\w-]+/gi, 'token=[REDACTED]');

    // Remove IP addresses
    message = message.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]');

    // Remove bearer tokens
    message = message.replace(/Bearer\s+[\w.-]+/gi, 'Bearer [REDACTED]');

    return message;
  }

  /**
   * Sanitize URL by removing sensitive query parameters
   */
  sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);

      // Remove sensitive query parameters
      const sensitiveParams = ['api_key', 'apikey', 'key', 'token', 'auth', 'secret'];
      sensitiveParams.forEach(param => {
        if (parsed.searchParams.has(param)) {
          parsed.searchParams.set(param, '[REDACTED]');
        }
      });

      return parsed.toString();
    } catch {
      // If URL parsing fails, just mask the whole thing
      return '[INVALID_URL]';
    }
  }

  /**
   * Validate timestamp is within reasonable bounds
   */
  isValidTimestamp(timestamp: number): boolean {
    const now = Date.now();
    const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
    const oneYearFromNow = now + (365 * 24 * 60 * 60 * 1000);

    return timestamp >= oneYearAgo && timestamp <= oneYearFromNow;
  }

  /**
   * Validate date string format (YYYY-MM-DD)
   */
  isValidDateString(dateStr: string): boolean {
    if (!dateStr || typeof dateStr !== 'string') return false;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) return false;

    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }

  /**
   * Parse and validate date parameter
   *
   * @throws BadRequestException if date is invalid
   */
  parseAndValidateDate(dateStr: string): Date {
    if (!this.isValidDateString(dateStr)) {
      throw new BadRequestException(
        `Invalid date format: ${dateStr}. Expected format: YYYY-MM-DD`,
      );
    }

    const date = new Date(dateStr + 'T00:00:00.000Z');
    this.validateDateRange(date);

    return date;
  }
}
