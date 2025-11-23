import { Injectable } from '@nestjs/common';

/**
 * Centralized Currency Conversion Service
 *
 * Handles all Rial ↔ Toman conversions in one place.
 * This service converts values at the output (display) layer,
 * preserving raw API data in the database.
 *
 * Iranian Currency Units:
 * - Rial: Official currency unit (smaller)
 * - Toman: Common usage unit = 10 Rials
 * - 1 Toman = 10 Rials
 * - Example: 625,000 Rials = 62,500 Tomans
 */
@Injectable()
export class CurrencyConversionService {
  private readonly RIAL_TO_TOMAN_FACTOR = 10;

  /**
   * Convert a single value from Rial to Toman
   * @param rialValue - Value in Iranian Rial
   * @returns Value in Toman (Rial ÷ 10)
   */
  rialToToman(rialValue: number | string | null | undefined): number {
    if (rialValue === null || rialValue === undefined) {
      return 0;
    }

    const numericValue = typeof rialValue === 'string'
      ? parseFloat(rialValue)
      : rialValue;

    if (isNaN(numericValue)) {
      return 0;
    }

    return numericValue / this.RIAL_TO_TOMAN_FACTOR;
  }

  /**
   * Convert a single value from Toman to Rial
   * @param tomanValue - Value in Toman
   * @returns Value in Iranian Rial (Toman × 10)
   */
  tomanToRial(tomanValue: number | string | null | undefined): number {
    if (tomanValue === null || tomanValue === undefined) {
      return 0;
    }

    const numericValue = typeof tomanValue === 'string'
      ? parseFloat(tomanValue)
      : tomanValue;

    if (isNaN(numericValue)) {
      return 0;
    }

    return numericValue * this.RIAL_TO_TOMAN_FACTOR;
  }

  /**
   * Convert a value and return as string (for API responses)
   * @param rialValue - Value in Iranian Rial
   * @returns Value in Toman as string
   */
  rialToTomanString(rialValue: number | string | null | undefined): string {
    return this.rialToToman(rialValue).toString();
  }

  /**
   * Convert an object containing price fields from Rial to Toman
   * Useful for converting entire API response objects
   *
   * @param data - Object with price fields in Rial
   * @param fields - Array of field names to convert (default: ['value', 'price', 'change', 'high', 'low'])
   * @returns New object with specified fields converted to Toman
   */
  convertPriceObject<T extends Record<string, any>>(
    data: T,
    fields: string[] = ['value', 'price', 'change', 'high', 'low']
  ): T {
    const converted: Record<string, any> = { ...data };

    for (const field of fields) {
      if (field in converted) {
        const value = converted[field];

        // Handle string values (like API response "value" field)
        if (typeof value === 'string') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            converted[field] = this.rialToTomanString(numValue);
          }
        }
        // Handle numeric values
        else if (typeof value === 'number') {
          converted[field] = this.rialToToman(value);
        }
      }
    }

    return converted as T;
  }

  /**
   * Convert a nested response object (e.g., Navasan API response with multiple items)
   *
   * @param response - Response object with nested item data
   * @param dataKey - Key containing the items (default: 'data')
   * @param excludeKeys - Keys to exclude from conversion (e.g., '_metadata')
   * @param priceFields - Fields to convert in each item
   * @returns Converted response object
   */
  convertResponse<T extends Record<string, any>>(
    response: T,
    options: {
      dataKey?: string;
      excludeKeys?: string[];
      priceFields?: string[];
      itemCodesToExclude?: string[]; // Items that are already in Toman (e.g., historical data)
    } = {}
  ): T {
    const {
      dataKey = 'data',
      excludeKeys = ['_metadata'],
      priceFields = ['value', 'price', 'change', 'high', 'low'],
      itemCodesToExclude = []
    } = options;

    const converted: Record<string, any> = { ...response };

    // If response has a data key, convert items within it
    if (dataKey in converted && typeof converted[dataKey] === 'object') {
      const dataObject = converted[dataKey] as Record<string, any>;
      const convertedData: Record<string, any> = {};

      for (const [key, value] of Object.entries(dataObject)) {
        // Skip excluded keys (like _metadata)
        if (excludeKeys.includes(key)) {
          convertedData[key] = value;
          continue;
        }

        // Skip items that are already in Toman
        if (itemCodesToExclude.includes(key)) {
          convertedData[key] = value;
          continue;
        }

        // Convert the item's price fields
        if (value && typeof value === 'object') {
          convertedData[key] = this.convertPriceObject(value, priceFields);
        } else {
          convertedData[key] = value;
        }
      }

      converted[dataKey] = convertedData;
    }

    return converted as T;
  }

  /**
   * Determine if a value is likely in Rial or Toman based on magnitude
   * Useful for detecting data that may already be converted
   *
   * @param value - Value to check
   * @param expectedTomanRange - Expected range for Toman (e.g., [50000, 150000] for USD)
   * @returns true if value appears to be in Rial (10x larger than expected Toman)
   */
  isLikelyRial(value: number, expectedTomanRange: [number, number]): boolean {
    const [minToman, maxToman] = expectedTomanRange;
    const minRial = minToman * this.RIAL_TO_TOMAN_FACTOR;
    const maxRial = maxToman * this.RIAL_TO_TOMAN_FACTOR;

    // If value is in the Rial range, it's likely Rial
    return value >= minRial && value <= maxRial;
  }

  /**
   * Smart conversion that detects if value is already in Toman
   *
   * @param value - Value that may be in Rial or Toman
   * @param expectedTomanRange - Expected range if already in Toman
   * @returns Value in Toman
   */
  smartConvert(value: number, expectedTomanRange: [number, number]): number {
    if (this.isLikelyRial(value, expectedTomanRange)) {
      return this.rialToToman(value);
    }
    return value; // Already in Toman
  }
}
