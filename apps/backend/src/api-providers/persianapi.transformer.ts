import { Injectable, Logger } from "@nestjs/common";
import {
  CurrencyData,
  CryptoData,
  GoldData,
  CoinData,
} from "./api-provider.interface";
/**
 * Price item structure for Navasan format compatibility
 */
interface NavasanPriceItem {
  value: string;
  change: number | null;
  utc: string;
  date: string;
  dt: string;
}

/**
 * PersianApiTransformer
 *
 * Responsible for transforming PersianAPI data format to standard Navasan format.
 * This isolates provider-specific transformation logic from business logic.
 *
 * Transformation Rules:
 * - Currencies: Use price field (already in Toman)
 * - Crypto: Use priceIrt field (converted to Toman in provider)
 * - Gold: Use price field (already in Toman)
 * - Coins: Use price field (already in Toman)
 *
 * Date Format:
 * - Converts JavaScript Date to Persian (Jalali) date string
 * - UTC timestamp preserved
 */
@Injectable()
export class PersianApiTransformer {
  private readonly logger = new Logger(PersianApiTransformer.name);

  /**
   * Transform array of data items to Navasan response format
   * @param data Array of currency, crypto, gold, or coin data
   * @returns Record with code as key and NavasanPriceItem as value
   */
  transformToNavasanFormat(
    data: (CurrencyData | CryptoData | GoldData | CoinData)[],
  ): Record<string, NavasanPriceItem> {
    const result: Record<string, NavasanPriceItem> = {};

    for (const item of data) {
      try {
        const key = item.code;
        const timestamp = item.updatedAt || new Date();

        // Determine price value based on data type
        const priceValue = this.getPriceValue(item);

        // Map to Navasan format
        result[key] = {
          value: String(priceValue),
          change: this.getChangeValue(item),
          utc: timestamp.toISOString(),
          date: this.toJalaliDateString(timestamp),
          dt: this.toTimeString(timestamp),
        };
      } catch (error) {
        this.logger.error(
          `Failed to transform item ${item.code}`,
          error instanceof Error ? error.stack : error,
        );
        // Skip invalid items instead of failing entire transformation
        continue;
      }
    }

    return result;
  }

  /**
   * Get price value from data item
   * For crypto: uses priceIrt (Toman)
   * For others: uses price field
   */
  private getPriceValue(
    item: CurrencyData | CryptoData | GoldData | CoinData,
  ): number {
    // Type guard for crypto data (has priceIrt and symbol)
    const isCrypto = "priceIrt" in item && "symbol" in item;

    if (isCrypto) {
      // Crypto: Use Toman price (already converted from Rials in provider)
      return (item as CryptoData).priceIrt || 0;
    }

    // Currency/Gold/Coin: Use standard price field
    return item.price || 0;
  }

  /**
   * Get change value from data item
   * Different data types have different change field names
   */
  private getChangeValue(
    item: CurrencyData | CryptoData | GoldData | CoinData,
  ): number {
    // CurrencyData has 'change' field
    if ("change" in item && item.change !== undefined) {
      return item.change;
    }

    // CryptoData has 'change24h' field
    if ("change24h" in item && item.change24h !== undefined) {
      return item.change24h;
    }

    // Gold/Coin don't have change data from PersianAPI
    return 0;
  }

  /**
   * Convert JavaScript Date to Jalali (Persian) date string
   * Format: YYYY/MM/DD (e.g., "1402/08/24")
   */
  private toJalaliDateString(date: Date): string {
    try {
      // Use Intl.DateTimeFormat with Persian calendar
      const formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Tehran",
      });

      const parts = formatter.formatToParts(date);
      const year = parts.find((p) => p.type === "year")?.value || "1400";
      const month = parts.find((p) => p.type === "month")?.value || "01";
      const day = parts.find((p) => p.type === "day")?.value || "01";

      return `${year}/${month}/${day}`;
    } catch (error) {
      this.logger.warn(
        `Failed to convert to Jalali date: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      // Fallback to ISO date
      return date.toISOString().split("T")[0];
    }
  }

  /**
   * Convert JavaScript Date to time string in Tehran timezone
   * Format: HH:mm:ss (24-hour format)
   */
  private toTimeString(date: Date): string {
    try {
      // Use Intl.DateTimeFormat with Tehran timezone
      const formatter = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Asia/Tehran",
      });

      return formatter.format(date);
    } catch (error) {
      this.logger.warn(
        `Failed to convert to Tehran time: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      // Fallback to UTC time
      const hours = String(date.getUTCHours()).padStart(2, "0");
      const minutes = String(date.getUTCMinutes()).padStart(2, "0");
      const seconds = String(date.getUTCSeconds()).padStart(2, "0");
      return `${hours}:${minutes}:${seconds}`;
    }
  }

  /**
   * Transform single item (useful for testing and debugging)
   */
  transformSingleItem(
    item: CurrencyData | CryptoData | GoldData | CoinData,
  ): NavasanPriceItem {
    const result = this.transformToNavasanFormat([item]);
    return result[item.code];
  }
}
