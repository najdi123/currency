import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { PersianApiProvider } from "./persianapi.provider";
import { ApiProviderFactory } from "./api-provider.factory";
import { ProviderRegistry } from "./provider-registry.service";
import { PersianApiTransformer } from "./persianapi.transformer";
import { ProviderOrchestrator } from "./provider-orchestrator.service";

/**
 * API Providers Module
 *
 * Provides multi-provider architecture for fetching currency, crypto, and gold data.
 * Includes provider registry, transformers, and factory for managing multiple data sources.
 *
 * Exported Services:
 * - ApiProviderFactory: Main entry point for accessing providers
 * - ProviderRegistry: Registry of all available providers
 * - PersianApiProvider: PersianAPI implementation (for direct access if needed)
 * - PersianApiTransformer: Transformer for PersianAPI data format
 *
 * Future providers can be added by:
 * 1. Implementing IApiProvider interface
 * 2. Creating corresponding transformer
 * 3. Registering in this module
 * 4. Configuring in provider.config.ts
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    ConfigModule,
  ],
  providers: [
    // Provider implementations
    PersianApiProvider,

    // Infrastructure services
    ProviderRegistry,
    ProviderOrchestrator,
    ApiProviderFactory,

    // Transformers
    PersianApiTransformer,
  ],
  exports: [
    // Export factory as main entry point
    ApiProviderFactory,

    // Export registry for advanced use cases
    ProviderRegistry,

    // Export orchestrator for advanced use cases
    ProviderOrchestrator,

    // Export providers for direct access if needed
    PersianApiProvider,

    // Export transformers for reuse
    PersianApiTransformer,
  ],
})
export class ApiProvidersModule {}
