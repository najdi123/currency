import { Injectable, Logger } from "@nestjs/common";
import { IApiProvider } from "./api-provider.interface";
import { PersianApiProvider } from "./persianapi.provider";

/**
 * API Provider Factory
 *
 * Provides the PersianAPI provider for all data fetching.
 * Simplified to use only PersianAPI.
 */
@Injectable()
export class ApiProviderFactory {
  private readonly logger = new Logger(ApiProviderFactory.name);

  constructor(private readonly persianApiProvider: PersianApiProvider) {
    this.logger.log("Initialized with PersianAPI provider");
  }

  /**
   * Get the active provider (always PersianAPI)
   */
  getActiveProvider(): IApiProvider {
    return this.persianApiProvider;
  }

  /**
   * Get the name of the active provider
   */
  getActiveProviderName(): string {
    return "persianapi";
  }

  /**
   * Validate that the provider is working
   */
  async validateActiveProvider(): Promise<boolean> {
    try {
      const isValid = await this.persianApiProvider.validateApiKey();

      if (isValid) {
        this.logger.log("PersianAPI validated successfully");
      } else {
        this.logger.error("PersianAPI validation failed");
      }

      return isValid;
    } catch (error) {
      this.logger.error("Failed to validate PersianAPI", error);
      return false;
    }
  }

  /**
   * Get provider metadata
   */
  getMetadata() {
    return this.persianApiProvider.getMetadata();
  }
}
