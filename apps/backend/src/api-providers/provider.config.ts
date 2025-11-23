import { DataType } from "./provider-registry.service";

/**
 * Provider Configuration Schema
 *
 * Defines how providers are configured, prioritized, and orchestrated.
 * Configuration can be loaded from environment variables or config files.
 */

/**
 * Configuration for a single provider
 */
export interface ProviderConfig {
  /** Provider name (must match registered provider) */
  name: string;

  /** Whether this provider is enabled */
  enabled: boolean;

  /** Priority (1 = highest, lower numbers have higher priority) */
  priority: number;

  /** Data types this provider can handle */
  capabilities: DataType[];

  /** Optional: Provider-specific settings */
  settings?: {
    /** API key (loaded from env) */
    apiKey?: string;

    /** Base URL for API */
    baseUrl?: string;

    /** Rate limit (requests per second) */
    rateLimit?: number;

    /** Request timeout (milliseconds) */
    timeout?: number;

    /** Enable request caching */
    enableCache?: boolean;

    /** Cache TTL (seconds) */
    cacheTTL?: number;
  };
}

/**
 * Global provider orchestration configuration
 */
export interface ProviderOrchestrationConfig {
  /** Strategy for selecting providers */
  selectionStrategy: "priority" | "round-robin" | "load-balanced";

  /** Strategy for merging data from multiple providers */
  mergeStrategy: "override" | "average" | "newest" | "manual";

  /** Enable fallback to secondary providers on failure */
  enableFallback: boolean;

  /** Maximum number of fallback attempts */
  maxFallbackAttempts: number;

  /** Timeout for provider requests (milliseconds) */
  requestTimeout: number;

  /** Enable parallel requests to multiple providers */
  enableParallelFetch: boolean;

  /** Provider-specific overrides */
  dataTypeConfig?: {
    currencies?: DataTypeConfig;
    crypto?: DataTypeConfig;
    gold?: DataTypeConfig;
    coins?: DataTypeConfig;
  };
}

/**
 * Configuration for a specific data type
 */
export interface DataTypeConfig {
  /** Primary provider name */
  primary: string;

  /** Fallback provider names (in order) */
  fallbacks?: string[];

  /** Merge strategy for this data type */
  mergeStrategy?: "override" | "average" | "newest";

  /** Cache TTL override for this data type (seconds) */
  cacheTTL?: number;

  /** Enable stale data serving while revalidating */
  staleWhileRevalidate?: boolean;
}

/**
 * Default provider configurations
 * Can be overridden by environment variables
 */
export const DEFAULT_PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    name: "persianapi",
    enabled: true,
    priority: 1, // Default primary provider
    capabilities: ["currencies", "crypto", "gold", "coins"],
    settings: {
      rateLimit: 0.2, // 1 request per 5 seconds
      timeout: 10000, // 10 seconds
      enableCache: true,
      cacheTTL: 300, // 5 minutes
    },
  },
  // Gold API will be added here when implemented
  // {
  //   name: "goldapi",
  //   enabled: false, // Disabled until implemented
  //   priority: 1, // Higher priority for gold data
  //   capabilities: ["gold"],
  //   settings: {
  //     rateLimit: 10,
  //     timeout: 5000,
  //     enableCache: true,
  //     cacheTTL: 60,
  //   },
  // },
];

/**
 * Default orchestration configuration
 */
export const DEFAULT_ORCHESTRATION_CONFIG: ProviderOrchestrationConfig = {
  selectionStrategy: "priority",
  mergeStrategy: "override", // Primary provider overrides others
  enableFallback: true,
  maxFallbackAttempts: 2,
  requestTimeout: 15000, // 15 seconds total
  enableParallelFetch: false, // Disabled by default for simplicity
  dataTypeConfig: {
    currencies: {
      primary: "persianapi",
      fallbacks: [],
      mergeStrategy: "override",
      cacheTTL: 300,
    },
    crypto: {
      primary: "persianapi",
      fallbacks: [],
      mergeStrategy: "newest", // Use newest crypto data
      cacheTTL: 60, // Crypto changes fast, shorter cache
    },
    gold: {
      primary: "persianapi",
      fallbacks: [],
      mergeStrategy: "average", // Average gold prices for accuracy
      cacheTTL: 300,
    },
    coins: {
      primary: "persianapi",
      fallbacks: [],
      mergeStrategy: "override",
      cacheTTL: 300,
    },
  },
};

/**
 * Load provider configuration from environment variables
 *
 * Environment variable format:
 * PROVIDER_<NAME>_ENABLED=true|false
 * PROVIDER_<NAME>_PRIORITY=1-100
 * PROVIDER_<NAME>_CAPABILITIES=currencies,crypto,gold
 *
 * Example:
 * PROVIDER_PERSIANAPI_ENABLED=true
 * PROVIDER_PERSIANAPI_PRIORITY=1
 * PROVIDER_GOLDAPI_ENABLED=true
 * PROVIDER_GOLDAPI_PRIORITY=1
 * PROVIDER_GOLDAPI_CAPABILITIES=gold
 */
export function loadProviderConfigFromEnv(
  providerName: string,
  defaults: ProviderConfig,
): ProviderConfig {
  const prefix = `PROVIDER_${providerName.toUpperCase()}`;

  const priorityEnv = process.env[`${prefix}_PRIORITY`];
  const capabilitiesEnv = process.env[`${prefix}_CAPABILITIES`];

  return {
    name: providerName,
    enabled: process.env[`${prefix}_ENABLED`]
      ? process.env[`${prefix}_ENABLED`] === "true"
      : defaults.enabled,
    priority: priorityEnv
      ? parseInt(priorityEnv, 10)
      : defaults.priority,
    capabilities: capabilitiesEnv
      ? (capabilitiesEnv.split(",") as DataType[])
      : defaults.capabilities,
    settings: {
      ...defaults.settings,
      apiKey: process.env[`${providerName.toUpperCase()}_API_KEY`],
    },
  };
}

/**
 * Type guard for selection strategy
 */
function isValidSelectionStrategy(
  value: string,
): value is "priority" | "round-robin" | "load-balanced" {
  return ["priority", "round-robin", "load-balanced"].includes(value);
}

/**
 * Type guard for merge strategy
 */
function isValidMergeStrategy(
  value: string,
): value is "override" | "average" | "newest" | "manual" {
  return ["override", "average", "newest", "manual"].includes(value);
}

/**
 * Parse selection strategy from environment variable
 */
function parseSelectionStrategy(
  value: string | undefined,
): "priority" | "round-robin" | "load-balanced" {
  if (value && isValidSelectionStrategy(value)) {
    return value;
  }
  return DEFAULT_ORCHESTRATION_CONFIG.selectionStrategy;
}

/**
 * Parse merge strategy from environment variable
 */
function parseMergeStrategy(
  value: string | undefined,
): "override" | "average" | "newest" | "manual" {
  if (value && isValidMergeStrategy(value)) {
    return value;
  }
  return DEFAULT_ORCHESTRATION_CONFIG.mergeStrategy;
}

/**
 * Load orchestration configuration from environment variables
 */
export function loadOrchestrationConfigFromEnv(): ProviderOrchestrationConfig {
  const enableFallbackEnv = process.env.PROVIDER_ENABLE_FALLBACK;
  const maxFallbackEnv = process.env.PROVIDER_MAX_FALLBACK_ATTEMPTS;
  const timeoutEnv = process.env.PROVIDER_REQUEST_TIMEOUT;
  const enableParallelEnv = process.env.PROVIDER_ENABLE_PARALLEL_FETCH;

  return {
    selectionStrategy: parseSelectionStrategy(
      process.env.PROVIDER_SELECTION_STRATEGY,
    ),
    mergeStrategy: parseMergeStrategy(process.env.PROVIDER_MERGE_STRATEGY),
    enableFallback:
      enableFallbackEnv !== undefined
        ? enableFallbackEnv === "true"
        : DEFAULT_ORCHESTRATION_CONFIG.enableFallback,
    maxFallbackAttempts: maxFallbackEnv
      ? parseInt(maxFallbackEnv, 10)
      : DEFAULT_ORCHESTRATION_CONFIG.maxFallbackAttempts,
    requestTimeout: timeoutEnv
      ? parseInt(timeoutEnv, 10)
      : DEFAULT_ORCHESTRATION_CONFIG.requestTimeout,
    enableParallelFetch:
      enableParallelEnv !== undefined
        ? enableParallelEnv === "true"
        : DEFAULT_ORCHESTRATION_CONFIG.enableParallelFetch,
    dataTypeConfig: DEFAULT_ORCHESTRATION_CONFIG.dataTypeConfig,
  };
}

/**
 * Safely parse integer from environment variable
 * @param value The string value to parse
 * @param defaultValue Default value if parsing fails
 * @param min Minimum allowed value (optional)
 * @param max Maximum allowed value (optional)
 * @param varName Variable name for error messages
 * @returns Parsed integer or default value
 */
function safeParseInt(
  value: string | undefined,
  defaultValue: number,
  min?: number,
  max?: number,
  varName?: string,
): number {
  if (!value) {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    throw new Error(
      `Invalid ${varName || "value"}: "${value}". Must be a valid integer.`,
    );
  }

  if (min !== undefined && parsed < min) {
    throw new Error(
      `Invalid ${varName || "value"}: ${parsed}. Must be at least ${min}.`,
    );
  }

  if (max !== undefined && parsed > max) {
    throw new Error(
      `Invalid ${varName || "value"}: ${parsed}. Must be at most ${max}.`,
    );
  }

  return parsed;
}

/**
 * Validate provider configuration
 * @throws Error if configuration is invalid
 */
export function validateProviderConfig(config: ProviderConfig): void {
  if (!config.name || config.name.trim() === "") {
    throw new Error("Provider name cannot be empty");
  }

  if (config.priority < 1 || config.priority > 100) {
    throw new Error("Provider priority must be between 1 and 100");
  }

  if (!config.capabilities || config.capabilities.length === 0) {
    throw new Error("Provider must have at least one capability");
  }

  const validCapabilities: DataType[] = [
    "currencies",
    "crypto",
    "gold",
    "coins",
    "all",
  ];
  for (const cap of config.capabilities) {
    if (!validCapabilities.includes(cap)) {
      throw new Error(
        `Invalid capability: ${cap}. Must be one of: ${validCapabilities.join(", ")}`,
      );
    }
  }
}

/**
 * Validate orchestration configuration
 * @throws Error if configuration is invalid
 */
export function validateOrchestrationConfig(
  config: ProviderOrchestrationConfig,
): void {
  // Validate maxFallbackAttempts
  if (config.maxFallbackAttempts < 0 || config.maxFallbackAttempts > 10) {
    throw new Error(
      "maxFallbackAttempts must be between 0 and 10, got: " +
        config.maxFallbackAttempts,
    );
  }

  // Validate requestTimeout
  if (config.requestTimeout < 1000 || config.requestTimeout > 120000) {
    throw new Error(
      "requestTimeout must be between 1000ms and 120000ms (2 minutes), got: " +
        config.requestTimeout,
    );
  }

  // Validate dataTypeConfig if present
  if (config.dataTypeConfig) {
    const validDataTypes: DataType[] = ["currencies", "crypto", "gold", "coins"];

    for (const [dataType, dtConfig] of Object.entries(config.dataTypeConfig)) {
      // Validate data type key
      if (!validDataTypes.includes(dataType as DataType)) {
        throw new Error(
          `Invalid data type in dataTypeConfig: ${dataType}. Must be one of: ${validDataTypes.join(", ")}`,
        );
      }

      // Validate primary provider is specified
      if (!dtConfig.primary || dtConfig.primary.trim() === "") {
        throw new Error(
          `Primary provider not specified for data type: ${dataType}`,
        );
      }

      // Validate cacheTTL if present
      if (dtConfig.cacheTTL !== undefined) {
        if (dtConfig.cacheTTL < 0 || dtConfig.cacheTTL > 86400) {
          throw new Error(
            `cacheTTL for ${dataType} must be between 0 and 86400 seconds (24 hours), got: ${dtConfig.cacheTTL}`,
          );
        }
      }
    }
  }
}
