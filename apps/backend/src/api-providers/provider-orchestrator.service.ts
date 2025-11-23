import { Injectable, Logger } from "@nestjs/common";
import { IApiProvider, FetchParams } from "./api-provider.interface";
import { ProviderRegistry, DataType } from "./provider-registry.service";
import {
  ProviderOrchestrationConfig,
  DataTypeConfig,
  DEFAULT_ORCHESTRATION_CONFIG,
} from "./provider.config";

/**
 * Result of a provider fetch operation
 */
export interface ProviderFetchResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  providerName: string;
  duration: number; // milliseconds
  attemptNumber: number;
}

/**
 * Orchestration result with metadata
 */
export interface OrchestrationResult<T> {
  data: T;
  metadata: {
    primaryProvider: string;
    usedFallback: boolean;
    fallbackProvider?: string;
    totalAttempts: number;
    totalDuration: number; // milliseconds
    errors?: Array<{ provider: string; error: string }>;
  };
}

/**
 * ProviderOrchestrator
 *
 * Orchestrates multiple API providers with intelligent selection,
 * fallback mechanisms, and data merging strategies.
 *
 * Features:
 * - Automatic fallback to secondary providers on failure
 * - Configurable retry logic with exponential backoff
 * - Multiple data merging strategies (override, average, newest)
 * - Performance monitoring and error tracking
 * - Circuit breaker pattern for failing providers
 *
 * Usage:
 * ```typescript
 * const result = await orchestrator.fetchWithFallback(
 *   'crypto',
 *   (provider) => provider.fetchCrypto({ limit: 100 })
 * );
 * ```
 */
@Injectable()
export class ProviderOrchestrator {
  private readonly logger = new Logger(ProviderOrchestrator.name);
  private readonly config: ProviderOrchestrationConfig;

  // Circuit breaker state per provider
  private circuitBreakers = new Map<
    string,
    {
      failures: number;
      lastFailure: Date | null;
      isOpen: boolean;
    }
  >();

  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // Open after 5 failures
  private readonly CIRCUIT_BREAKER_RESET_TIME = 60000; // 1 minute

  constructor(private readonly providerRegistry: ProviderRegistry) {
    this.config = DEFAULT_ORCHESTRATION_CONFIG;
    this.logger.log("ProviderOrchestrator initialized");
  }

  /**
   * Fetch data with automatic fallback to secondary providers
   *
   * @param dataType The type of data to fetch
   * @param fetchFn Function that fetches data from a provider
   * @param params Optional parameters for the fetch operation
   * @returns Orchestration result with data and metadata
   */
  async fetchWithFallback<T>(
    dataType: DataType,
    fetchFn: (provider: IApiProvider) => Promise<T>,
    params?: FetchParams,
  ): Promise<OrchestrationResult<T>> {
    const startTime = Date.now();
    const errors: Array<{ provider: string; error: string }> = [];

    // Get primary provider
    const primaryProvider = this.providerRegistry.getPrimaryProvider(dataType);
    if (!primaryProvider) {
      throw new Error(`No provider available for data type: ${dataType}`);
    }

    const primaryProviderName =
      this.providerRegistry.getProviderNamesByCapability(dataType)[0];

    // Try primary provider first
    const primaryResult = await this.tryProvider(
      primaryProviderName,
      primaryProvider,
      fetchFn,
      1,
    );

    if (primaryResult.success && primaryResult.data) {
      return {
        data: primaryResult.data,
        metadata: {
          primaryProvider: primaryProviderName,
          usedFallback: false,
          totalAttempts: 1,
          totalDuration: Date.now() - startTime,
        },
      };
    }

    // Primary failed, log error
    if (primaryResult.error) {
      errors.push({
        provider: primaryProviderName,
        error: primaryResult.error.message,
      });
      this.logger.warn(
        `Primary provider '${primaryProviderName}' failed: ${primaryResult.error.message}`,
      );
    }

    // Try fallback providers if enabled
    if (this.config.enableFallback) {
      const fallbackProviders =
        this.providerRegistry.getFallbackProviders(dataType);
      const fallbackNames =
        this.providerRegistry.getProviderNamesByCapability(dataType).slice(1);

      for (let i = 0; i < fallbackProviders.length; i++) {
        // Check if we've exceeded max attempts
        if (errors.length >= this.config.maxFallbackAttempts + 1) {
          this.logger.error(
            `Exceeded max fallback attempts (${this.config.maxFallbackAttempts})`,
          );
          break;
        }

        const fallbackProvider = fallbackProviders[i];
        const fallbackName = fallbackNames[i];

        this.logger.log(
          `Trying fallback provider '${fallbackName}' (attempt ${i + 2})`,
        );

        const fallbackResult = await this.tryProvider(
          fallbackName,
          fallbackProvider,
          fetchFn,
          i + 2,
        );

        if (fallbackResult.success && fallbackResult.data) {
          this.logger.log(
            `✅ Fallback provider '${fallbackName}' succeeded after ${errors.length} failures`,
          );

          return {
            data: fallbackResult.data,
            metadata: {
              primaryProvider: primaryProviderName,
              usedFallback: true,
              fallbackProvider: fallbackName,
              totalAttempts: i + 2,
              totalDuration: Date.now() - startTime,
              errors,
            },
          };
        }

        // Fallback also failed
        if (fallbackResult.error) {
          errors.push({
            provider: fallbackName,
            error: fallbackResult.error.message,
          });
          this.logger.warn(
            `Fallback provider '${fallbackName}' failed: ${fallbackResult.error.message}`,
          );
        }
      }
    }

    // All providers failed
    const errorMessage = `All providers failed for ${dataType}. Errors: ${errors.map((e) => `${e.provider}: ${e.error}`).join("; ")}`;
    this.logger.error(errorMessage);

    throw new Error(errorMessage);
  }

  /**
   * Fetch data from multiple providers in parallel and merge results
   *
   * @param dataType The type of data to fetch
   * @param fetchFn Function that fetches data from a provider
   * @param mergeStrategy Strategy for merging data from multiple providers
   * @returns Merged data from all successful providers
   */
  async fetchParallel<T>(
    dataType: DataType,
    fetchFn: (provider: IApiProvider) => Promise<T>,
    mergeStrategy?: "override" | "average" | "newest",
  ): Promise<T> {
    if (!this.config.enableParallelFetch) {
      this.logger.warn(
        "Parallel fetch is disabled. Use fetchWithFallback instead.",
      );
      const result = await this.fetchWithFallback(dataType, fetchFn);
      return result.data;
    }

    const providers = this.providerRegistry.getProvidersByCapability(dataType);
    const providerNames =
      this.providerRegistry.getProviderNamesByCapability(dataType);

    if (providers.length === 0) {
      throw new Error(`No providers available for data type: ${dataType}`);
    }

    this.logger.log(
      `Fetching data from ${providers.length} providers in parallel for ${dataType}`,
    );

    // Fetch from all providers in parallel
    const promises = providers.map((provider, index) =>
      this.tryProvider(providerNames[index], provider, fetchFn, 1),
    );

    const results = await Promise.all(promises);

    // Filter successful results
    const successfulResults = results.filter(
      (r) => r.success && r.data,
    ) as Array<ProviderFetchResult<T> & { data: T }>;

    if (successfulResults.length === 0) {
      const errors = results
        .filter((r) => r.error)
        .map((r) => `${r.providerName}: ${r.error!.message}`)
        .join("; ");
      throw new Error(
        `All parallel providers failed for ${dataType}. Errors: ${errors}`,
      );
    }

    this.logger.log(
      `${successfulResults.length}/${providers.length} providers succeeded`,
    );

    // Use merge strategy to combine results
    // For 'all' dataType, use default strategy. For specific types, check config.
    const strategy =
      mergeStrategy ||
      (dataType !== "all" && this.config.dataTypeConfig?.[dataType]?.mergeStrategy) ||
      "override";

    return this.mergeResults(successfulResults, strategy);
  }

  /**
   * Merge results from multiple providers using specified strategy
   *
   * @param results Array of successful provider results
   * @param strategy Merge strategy to use
   * @returns Merged data
   */
  private mergeResults<T>(
    results: Array<ProviderFetchResult<T> & { data: T }>,
    strategy: "override" | "average" | "newest",
  ): T {
    // Single result - no merging needed
    if (results.length === 1) {
      return results[0].data;
    }

    switch (strategy) {
      case "override":
        // Primary provider (highest priority) overrides others
        this.logger.debug(
          `Using override strategy: returning data from ${results[0].providerName}`,
        );
        return results[0].data;

      case "newest":
        // Use data with most recent timestamp
        return this.mergeNewest(results);

      case "average":
        // Average numeric values from all providers
        return this.mergeAverage(results);

      default:
        // Fallback to override
        this.logger.warn(
          `Unknown merge strategy: ${strategy}, falling back to override`,
        );
        return results[0].data;
    }
  }

  /**
   * Merge strategy: Use data with most recent timestamp
   *
   * Assumes T is an array of objects with 'updatedAt' field
   */
  private mergeNewest<T>(
    results: Array<ProviderFetchResult<T> & { data: T }>,
  ): T {
    this.logger.debug(
      `Using newest strategy with ${results.length} provider results`,
    );

    // Check if data is an array
    const firstData = results[0].data;
    if (!Array.isArray(firstData)) {
      this.logger.warn(
        "Newest strategy requires array data, falling back to override",
      );
      return firstData;
    }

    // Combine all items from all providers
    const allItems = results.flatMap((r) => r.data as any[]);

    // Group by code
    const itemsByCode = new Map<string, any[]>();
    for (const item of allItems) {
      if (!item.code) continue;

      if (!itemsByCode.has(item.code)) {
        itemsByCode.set(item.code, []);
      }
      itemsByCode.get(item.code)!.push(item);
    }

    // For each code, select the item with newest updatedAt
    const mergedItems: any[] = [];
    for (const [code, items] of itemsByCode.entries()) {
      const newest = items.reduce((prev, current) => {
        const prevTime = prev.updatedAt
          ? new Date(prev.updatedAt).getTime()
          : 0;
        const currentTime = current.updatedAt
          ? new Date(current.updatedAt).getTime()
          : 0;
        return currentTime > prevTime ? current : prev;
      });
      mergedItems.push(newest);
    }

    this.logger.debug(
      `Merged ${allItems.length} items from ${results.length} providers into ${mergedItems.length} unique items (newest)`,
    );

    return mergedItems as T;
  }

  /**
   * Merge strategy: Average numeric values from all providers
   *
   * Assumes T is an array of objects with numeric fields like 'price'
   */
  private mergeAverage<T>(
    results: Array<ProviderFetchResult<T> & { data: T }>,
  ): T {
    this.logger.debug(
      `Using average strategy with ${results.length} provider results`,
    );

    // Check if data is an array
    const firstData = results[0].data;
    if (!Array.isArray(firstData)) {
      this.logger.warn(
        "Average strategy requires array data, falling back to override",
      );
      return firstData;
    }

    // Combine all items from all providers
    const allItems = results.flatMap((r) => r.data as any[]);

    // Group by code
    const itemsByCode = new Map<string, any[]>();
    for (const item of allItems) {
      if (!item.code) continue;

      if (!itemsByCode.has(item.code)) {
        itemsByCode.set(item.code, []);
      }
      itemsByCode.get(item.code)!.push(item);
    }

    // For each code, average numeric fields
    const mergedItems: any[] = [];
    for (const [code, items] of itemsByCode.entries()) {
      if (items.length === 1) {
        // Only one provider has this item, use as-is
        mergedItems.push(items[0]);
        continue;
      }

      // Create merged item by averaging numeric fields
      const merged = { ...items[0] }; // Start with first item

      // Numeric fields to average
      const numericFields = [
        "price",
        "priceIrt",
        "change",
        "changePercent",
        "change1h",
        "change24h",
        "change7d",
        "high",
        "low",
        "high24h",
        "low24h",
        "marketCap",
        "volume24h",
      ];

      for (const field of numericFields) {
        if (typeof items[0][field] === "number") {
          // Average this field across all items that have it
          const values = items
            .map((item) => item[field])
            .filter((val) => typeof val === "number");

          if (values.length > 0) {
            const sum = values.reduce((acc, val) => acc + val, 0);
            merged[field] = sum / values.length;
          }
        }
      }

      // Use most recent updatedAt
      const mostRecent = items.reduce((prev, current) => {
        const prevTime = prev.updatedAt
          ? new Date(prev.updatedAt).getTime()
          : 0;
        const currentTime = current.updatedAt
          ? new Date(current.updatedAt).getTime()
          : 0;
        return currentTime > prevTime ? current : prev;
      });
      merged.updatedAt = mostRecent.updatedAt;

      mergedItems.push(merged);
    }

    this.logger.debug(
      `Merged ${allItems.length} items from ${results.length} providers into ${mergedItems.length} unique items (averaged)`,
    );

    return mergedItems as T;
  }

  /**
   * Try fetching data from a single provider with circuit breaker
   */
  private async tryProvider<T>(
    providerName: string,
    provider: IApiProvider,
    fetchFn: (provider: IApiProvider) => Promise<T>,
    attemptNumber: number,
  ): Promise<ProviderFetchResult<T>> {
    const startTime = Date.now();

    // Check circuit breaker
    if (this.isCircuitOpen(providerName)) {
      this.logger.warn(
        `Circuit breaker is OPEN for provider '${providerName}', skipping`,
      );
      return {
        success: false,
        error: new Error("Circuit breaker is open"),
        providerName,
        duration: 0,
        attemptNumber,
      };
    }

    try {
      // Execute fetch with timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Request timeout")),
          this.config.requestTimeout,
        ),
      );

      const data = await Promise.race([fetchFn(provider), timeoutPromise]);

      const duration = Date.now() - startTime;

      // Success - reset circuit breaker
      this.recordSuccess(providerName);

      return {
        success: true,
        data,
        providerName,
        duration,
        attemptNumber,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record failure for circuit breaker
      this.recordFailure(providerName);

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        providerName,
        duration,
        attemptNumber,
      };
    }
  }

  /**
   * Check if circuit breaker is open for a provider
   */
  private isCircuitOpen(providerName: string): boolean {
    const breaker = this.circuitBreakers.get(providerName);

    if (!breaker || !breaker.isOpen) {
      return false;
    }

    // Check if enough time has passed to reset the circuit
    if (breaker.lastFailure) {
      const timeSinceFailure =
        Date.now() - breaker.lastFailure.getTime();

      if (timeSinceFailure > this.CIRCUIT_BREAKER_RESET_TIME) {
        this.logger.log(
          `Circuit breaker reset for provider '${providerName}' after ${timeSinceFailure}ms`,
        );
        breaker.isOpen = false;
        breaker.failures = 0;
        return false;
      }
    }

    return true;
  }

  /**
   * Record a successful fetch for circuit breaker
   */
  private recordSuccess(providerName: string): void {
    const breaker = this.circuitBreakers.get(providerName);

    if (breaker) {
      // Gradually reduce failure count on success
      breaker.failures = Math.max(0, breaker.failures - 1);

      if (breaker.failures === 0) {
        breaker.isOpen = false;
        breaker.lastFailure = null;
      }
    }
  }

  /**
   * Record a failed fetch for circuit breaker
   */
  private recordFailure(providerName: string): void {
    let breaker = this.circuitBreakers.get(providerName);

    if (!breaker) {
      breaker = {
        failures: 0,
        lastFailure: null,
        isOpen: false,
      };
      this.circuitBreakers.set(providerName, breaker);
    }

    breaker.failures++;
    breaker.lastFailure = new Date();

    // Open circuit if threshold exceeded
    if (breaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      breaker.isOpen = true;
      this.logger.error(
        `🔒 Circuit breaker OPENED for provider '${providerName}' after ${breaker.failures} failures`,
      );
    }
  }

  /**
   * Get circuit breaker status for all providers
   */
  getCircuitBreakerStatus(): Map<
    string,
    { failures: number; isOpen: boolean; lastFailure: Date | null }
  > {
    return new Map(this.circuitBreakers);
  }

  /**
   * Manually reset circuit breaker for a provider
   */
  resetCircuitBreaker(providerName: string): void {
    const breaker = this.circuitBreakers.get(providerName);
    if (breaker) {
      breaker.failures = 0;
      breaker.isOpen = false;
      breaker.lastFailure = null;
      this.logger.log(`Circuit breaker manually reset for '${providerName}'`);
    }
  }

  /**
   * Get orchestration configuration
   */
  getConfig(): ProviderOrchestrationConfig {
    return { ...this.config };
  }

  /**
   * Update orchestration configuration
   */
  updateConfig(config: Partial<ProviderOrchestrationConfig>): void {
    Object.assign(this.config, config);
    this.logger.log("Orchestration configuration updated");
  }
}
