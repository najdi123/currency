import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { PersianApiProvider } from "./persianapi.provider";
import { ApiProviderFactory } from "./api-provider.factory";

/**
 * API Providers Module
 *
 * Provides PersianAPI integration for fetching currency, crypto, and gold data.
 * Exports ApiProviderFactory for use in other modules.
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    ConfigModule,
  ],
  providers: [PersianApiProvider, ApiProviderFactory],
  exports: [ApiProviderFactory, PersianApiProvider],
})
export class ApiProvidersModule {}
