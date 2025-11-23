import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { IApiProvider, FetchParams } from "./api-provider.interface";
import { PersianApiProvider } from "./persianapi.provider";
import { ProviderRegistry, DataType } from "./provider-registry.service";
import {
  ProviderOrchestrator,
  OrchestrationResult,
} from "./provider-orchestrator.service";

/**
 * API Provider Factory
 *
 * Factory for accessing API providers through the registry.
 * Manages provider initialization, selection, and health checking.
 *
 * Phase 1: ✅ Uses ProviderRegistry for provider management
 * Phase 2: ✅ Uses ProviderOrchestrator for fallback and smart selection
 */
@Injectable()
export class ApiProviderFactory implements OnModuleInit {
  private readonly logger = new Logger(ApiProviderFactory.name);
  private initialized = false;

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly providerOrchestrator: ProviderOrchestrator,
    private readonly persianApiProvider: PersianApiProvider,
  ) {
    this.logger.log("ApiProviderFactory created");
  }

  /**
   * Initialize factory and register all available providers
   */
  async onModuleInit() {
    this.logger.log("Initializing ApiProviderFactory...");

    // Register PersianAPI provider
    this.providerRegistry.registerProvider("persianapi", this.persianApiProvider, {
      enabled: true,
      priority: 1, // Highest priority (only provider for now)
      capabilities: ["currencies", "crypto", "gold", "coins"],
    });

    this.initialized = true;
    this.logger.log(
      `✅ ApiProviderFactory initialized with ${this.providerRegistry.getProviderCount()} provider(s)`,
    );

    // Log registry status
    const health = this.providerRegistry.getHealthStatus();
    this.logger.log(
      `Provider coverage - Currencies: ${health.coverage.currencies}, Crypto: ${health.coverage.crypto}, Gold: ${health.coverage.gold}, Coins: ${health.coverage.coins}`,
    );
  }

  /**
   * Get the primary provider for a specific data type
   * @param dataType The type of data (currencies, crypto, gold, coins)
   * @returns The highest priority provider for that data type
   * @throws Error if no provider is available for the data type
   */
  getProviderForDataType(dataType: DataType): IApiProvider {
    this.ensureInitialized();

    const provider = this.providerRegistry.getPrimaryProvider(dataType);

    if (!provider) {
      throw new Error(
        `No provider available for data type: ${dataType}. Please check provider configuration.`,
      );
    }

    return provider;
  }

  /**
   * Get all fallback providers for a data type (excluding primary)
   * @param dataType The type of data
   * @returns Array of fallback providers sorted by priority
   */
  getFallbackProviders(dataType: DataType): IApiProvider[] {
    this.ensureInitialized();
    return this.providerRegistry.getFallbackProviders(dataType);
  }

  /**
   * Get all providers that support a data type
   * @param dataType The type of data
   * @returns Array of providers sorted by priority (highest first)
   */
  getProvidersForDataType(dataType: DataType): IApiProvider[] {
    this.ensureInitialized();
    return this.providerRegistry.getProvidersByCapability(dataType);
  }

  /**
   * @deprecated Use getProviderForDataType('all') instead
   * Get the active provider (backward compatibility)
   */
  getActiveProvider(): IApiProvider {
    this.ensureInitialized();

    // For backward compatibility, return the primary provider for 'all' data types
    const provider = this.providerRegistry.getPrimaryProvider("all");

    if (!provider) {
      // Fallback to any enabled provider
      const allProviders = this.providerRegistry.getAllEnabledProviders();
      if (allProviders.length > 0) {
        return allProviders[0];
      }
      throw new Error("No providers available");
    }

    return provider;
  }

  /**
   * Get the name of the active provider
   * @deprecated Use getProviderNameForDataType() instead
   */
  getActiveProviderName(): string {
    this.ensureInitialized();
    const providers = this.providerRegistry.getProviderNamesByCapability("all");
    return providers[0] || "none";
  }

  /**
   * Get the name of the primary provider for a data type
   */
  getProviderNameForDataType(dataType: DataType): string {
    this.ensureInitialized();
    const providers = this.providerRegistry.getProviderNamesByCapability(dataType);
    return providers[0] || "none";
  }

  /**
   * Validate that the active provider is working
   */
  async validateActiveProvider(): Promise<boolean> {
    this.ensureInitialized();

    try {
      const provider = this.getActiveProvider();

      // Check if provider has validateApiKey method
      if ("validateApiKey" in provider) {
        const isValid = await (provider as any).validateApiKey();

        if (isValid) {
          this.logger.log("Provider validated successfully");
        } else {
          this.logger.error("Provider validation failed");
        }

        return isValid;
      }

      // If no validateApiKey method, assume valid
      this.logger.warn("Provider does not support validation");
      return true;
    } catch (error) {
      this.logger.error("Failed to validate provider", error);
      return false;
    }
  }

  /**
   * Check health of all registered providers
   * @returns Map of provider names to health status
   */
  async checkAllProvidersHealth(): Promise<Map<string, boolean>> {
    this.ensureInitialized();

    const results = new Map<string, boolean>();
    const providers = this.providerRegistry.getAllRegisteredProviders();

    for (const { name, provider, enabled } of providers) {
      if (!enabled) {
        results.set(name, false);
        continue;
      }

      try {
        // Check if provider has validateApiKey method
        if ("validateApiKey" in provider) {
          const isHealthy = await (provider as any).validateApiKey();
          results.set(name, isHealthy);
        } else {
          // If no validation method, assume healthy
          results.set(name, true);
        }
      } catch (error) {
        this.logger.error(`Health check failed for ${name}`, error);
        results.set(name, false);
      }
    }

    return results;
  }

  /**
   * Get provider metadata
   */
  getMetadata() {
    this.ensureInitialized();
    const provider = this.getActiveProvider();

    if ("getMetadata" in provider) {
      return (provider as any).getMetadata();
    }

    return { name: "unknown", version: "unknown" };
  }

  /**
   * Get registry health status
   */
  getRegistryHealth() {
    this.ensureInitialized();
    return this.providerRegistry.getHealthStatus();
  }

  /**
   * Enable a provider by name
   * @param name Provider name
   * @returns true if provider was enabled
   */
  enableProvider(name: string): boolean {
    this.ensureInitialized();
    return this.providerRegistry.enableProvider(name);
  }

  /**
   * Disable a provider by name
   * @param name Provider name
   * @returns true if provider was disabled
   */
  disableProvider(name: string): boolean {
    this.ensureInitialized();
    return this.providerRegistry.disableProvider(name);
  }

  /**
   * Fetch data with automatic fallback to secondary providers (Phase 2)
   *
   * @param dataType The type of data to fetch
   * @param fetchFn Function that fetches data from a provider
   * @returns Orchestration result with data and metadata
   *
   * @example
   * const result = await factory.fetchWithOrchestration(
   *   'crypto',
   *   (provider) => provider.fetchCrypto({ limit: 100 })
   * );
   * console.log(result.data); // Crypto data
   * console.log(result.metadata.usedFallback); // true if fallback was used
   */
  async fetchWithOrchestration<T>(
    dataType: DataType,
    fetchFn: (provider: IApiProvider) => Promise<T>,
  ): Promise<OrchestrationResult<T>> {
    this.ensureInitialized();
    return this.providerOrchestrator.fetchWithFallback(dataType, fetchFn);
  }

  /**
   * Fetch data from multiple providers in parallel and merge results (Phase 2)
   *
   * @param dataType The type of data to fetch
   * @param fetchFn Function that fetches data from a provider
   * @param mergeStrategy Strategy for merging data
   * @returns Merged data from all successful providers
   */
  async fetchParallel<T>(
    dataType: DataType,
    fetchFn: (provider: IApiProvider) => Promise<T>,
    mergeStrategy?: "override" | "average" | "newest",
  ): Promise<T> {
    this.ensureInitialized();
    return this.providerOrchestrator.fetchParallel(dataType, fetchFn, mergeStrategy);
  }

  /**
   * Get circuit breaker status for all providers
   */
  getCircuitBreakerStatus() {
    this.ensureInitialized();
    return this.providerOrchestrator.getCircuitBreakerStatus();
  }

  /**
   * Reset circuit breaker for a specific provider
   */
  resetCircuitBreaker(providerName: string): void {
    this.ensureInitialized();
    this.providerOrchestrator.resetCircuitBreaker(providerName);
  }

  /**
   * Get orchestration configuration
   */
  getOrchestrationConfig() {
    this.ensureInitialized();
    return this.providerOrchestrator.getConfig();
  }

  /**
   * Ensure the factory has been initialized
   * @throws Error if not initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        "ApiProviderFactory not initialized. This should not happen - check module initialization.",
      );
    }
  }
}
