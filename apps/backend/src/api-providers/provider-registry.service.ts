import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { IApiProvider } from "./api-provider.interface";

/**
 * Data types that providers can support
 */
export type DataType = "currencies" | "crypto" | "gold" | "coins" | "all";

/**
 * Provider metadata for registry
 */
export interface RegisteredProvider {
  name: string;
  provider: IApiProvider;
  enabled: boolean;
  priority: number; // Lower number = higher priority (1 is highest)
  capabilities: DataType[];
}

/**
 * ProviderRegistry
 *
 * Central registry for managing multiple API providers.
 * Provides discovery, registration, and querying capabilities.
 *
 * Features:
 * - Dynamic provider registration
 * - Capability-based provider lookup
 * - Priority-based provider ordering
 * - Enable/disable providers at runtime
 * - Health checking and validation
 *
 * Usage:
 * ```typescript
 * // Register a provider
 * registry.registerProvider('persianapi', persianApiProvider, {
 *   enabled: true,
 *   priority: 1,
 *   capabilities: ['currencies', 'crypto', 'gold']
 * });
 *
 * // Get providers that support gold data
 * const goldProviders = registry.getProvidersByCapability('gold');
 *
 * // Get highest priority provider
 * const primary = registry.getPrimaryProvider('gold');
 * ```
 */
@Injectable()
export class ProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(ProviderRegistry.name);
  private readonly providers = new Map<string, RegisteredProvider>();

  /**
   * Initialize registry on module load
   */
  async onModuleInit() {
    this.logger.log("ProviderRegistry initialized");
  }

  /**
   * Register a new provider
   * @param name Unique provider name (e.g., 'persianapi', 'goldapi')
   * @param provider Provider instance implementing IApiProvider
   * @param options Registration options (enabled, priority, capabilities)
   */
  registerProvider(
    name: string,
    provider: IApiProvider,
    options: {
      enabled?: boolean;
      priority?: number;
      capabilities?: DataType[];
    } = {},
  ): void {
    const {
      enabled = true,
      priority = 10, // Default medium priority
      capabilities = ["all"], // Default supports everything
    } = options;

    if (this.providers.has(name)) {
      this.logger.warn(
        `Provider '${name}' is already registered. Overwriting.`,
      );
    }

    const registered: RegisteredProvider = {
      name,
      provider,
      enabled,
      priority,
      capabilities,
    };

    this.providers.set(name, registered);
    this.logger.log(
      `Registered provider: ${name} (priority: ${priority}, capabilities: ${capabilities.join(", ")}, enabled: ${enabled})`,
    );
  }

  /**
   * Unregister a provider
   * @param name Provider name to remove
   * @returns true if provider was removed, false if not found
   */
  unregisterProvider(name: string): boolean {
    const deleted = this.providers.delete(name);
    if (deleted) {
      this.logger.log(`Unregistered provider: ${name}`);
    } else {
      this.logger.warn(`Provider '${name}' not found for unregistration`);
    }
    return deleted;
  }

  /**
   * Get a specific provider by name
   * @param name Provider name
   * @returns Provider instance or undefined if not found
   */
  getProvider(name: string): IApiProvider | undefined {
    const registered = this.providers.get(name);
    return registered?.enabled ? registered.provider : undefined;
  }

  /**
   * Get all registered provider information
   * @returns Array of registered provider metadata
   */
  getAllRegisteredProviders(): RegisteredProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get all enabled providers
   * @returns Array of enabled provider instances
   */
  getAllEnabledProviders(): IApiProvider[] {
    return Array.from(this.providers.values())
      .filter((p) => p.enabled)
      .map((p) => p.provider);
  }

  /**
   * Get providers that support a specific data type
   * @param dataType Type of data (currencies, crypto, gold, coins)
   * @returns Array of providers sorted by priority (highest first)
   */
  getProvidersByCapability(dataType: DataType): IApiProvider[] {
    const matchingProviders = Array.from(this.providers.values())
      .filter((p) => p.enabled)
      .filter(
        (p) =>
          p.capabilities.includes(dataType) || p.capabilities.includes("all"),
      )
      .sort((a, b) => a.priority - b.priority); // Lower number = higher priority

    return matchingProviders.map((p) => p.provider);
  }

  /**
   * Get the primary (highest priority) provider for a data type
   * @param dataType Type of data
   * @returns Primary provider or undefined if none available
   */
  getPrimaryProvider(dataType: DataType): IApiProvider | undefined {
    const providers = this.getProvidersByCapability(dataType);
    return providers[0]; // First in sorted array is highest priority
  }

  /**
   * Get fallback providers for a data type (all except primary)
   * @param dataType Type of data
   * @returns Array of fallback providers sorted by priority
   */
  getFallbackProviders(dataType: DataType): IApiProvider[] {
    const providers = this.getProvidersByCapability(dataType);
    return providers.slice(1); // All except first
  }

  /**
   * Get provider names that support a data type
   * @param dataType Type of data
   * @returns Array of provider names sorted by priority
   */
  getProviderNamesByCapability(dataType: DataType): string[] {
    return Array.from(this.providers.values())
      .filter((p) => p.enabled)
      .filter(
        (p) =>
          p.capabilities.includes(dataType) || p.capabilities.includes("all"),
      )
      .sort((a, b) => a.priority - b.priority)
      .map((p) => p.name);
  }

  /**
   * Enable a provider
   * @param name Provider name
   * @returns true if provider was enabled, false if not found
   */
  enableProvider(name: string): boolean {
    const registered = this.providers.get(name);
    if (registered) {
      registered.enabled = true;
      this.logger.log(`Enabled provider: ${name}`);
      return true;
    }
    this.logger.warn(`Provider '${name}' not found for enabling`);
    return false;
  }

  /**
   * Disable a provider
   * @param name Provider name
   * @returns true if provider was disabled, false if not found
   */
  disableProvider(name: string): boolean {
    const registered = this.providers.get(name);
    if (registered) {
      registered.enabled = false;
      this.logger.log(`Disabled provider: ${name}`);
      return true;
    }
    this.logger.warn(`Provider '${name}' not found for disabling`);
    return false;
  }

  /**
   * Check if a provider is registered and enabled
   * @param name Provider name
   * @returns true if registered and enabled
   */
  isProviderEnabled(name: string): boolean {
    const registered = this.providers.get(name);
    return registered?.enabled ?? false;
  }

  /**
   * Get provider priority
   * @param name Provider name
   * @returns Priority number or undefined if not found
   */
  getProviderPriority(name: string): number | undefined {
    return this.providers.get(name)?.priority;
  }

  /**
   * Update provider priority
   * @param name Provider name
   * @param priority New priority (lower = higher priority)
   * @returns true if updated, false if not found
   */
  updateProviderPriority(name: string, priority: number): boolean {
    const registered = this.providers.get(name);
    if (registered) {
      registered.priority = priority;
      this.logger.log(`Updated provider '${name}' priority to ${priority}`);
      return true;
    }
    this.logger.warn(`Provider '${name}' not found for priority update`);
    return false;
  }

  /**
   * Get count of registered providers
   * @returns Total number of registered providers
   */
  getProviderCount(): number {
    return this.providers.size;
  }

  /**
   * Get count of enabled providers
   * @returns Number of enabled providers
   */
  getEnabledProviderCount(): number {
    return Array.from(this.providers.values()).filter((p) => p.enabled).length;
  }

  /**
   * Validate that at least one provider exists for each data type
   * @returns Object with validation results per data type
   */
  validateCoverage(): {
    currencies: boolean;
    crypto: boolean;
    gold: boolean;
    coins: boolean;
  } {
    const dataTypes: DataType[] = ["currencies", "crypto", "gold", "coins"];
    const coverage: any = {};

    for (const dataType of dataTypes) {
      const providers = this.getProvidersByCapability(dataType);
      coverage[dataType] = providers.length > 0;
    }

    return coverage;
  }

  /**
   * Get registry health status
   * @returns Health information about the registry
   */
  getHealthStatus(): {
    totalProviders: number;
    enabledProviders: number;
    coverage: {
      currencies: boolean;
      crypto: boolean;
      gold: boolean;
      coins: boolean;
    };
    providers: Array<{
      name: string;
      enabled: boolean;
      priority: number;
      capabilities: DataType[];
    }>;
  } {
    const providers = Array.from(this.providers.values()).map((p) => ({
      name: p.name,
      enabled: p.enabled,
      priority: p.priority,
      capabilities: p.capabilities,
    }));

    return {
      totalProviders: this.getProviderCount(),
      enabledProviders: this.getEnabledProviderCount(),
      coverage: this.validateCoverage(),
      providers,
    };
  }
}
