import { Test, TestingModule } from "@nestjs/testing";
import { ApiProviderFactory } from "./api-provider.factory";
import { PersianApiProvider } from "./persianapi.provider";

describe("ApiProviderFactory", () => {
  let factory: ApiProviderFactory;
  let persianApiProvider: PersianApiProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiProviderFactory,
        {
          provide: PersianApiProvider,
          useValue: {
            getMetadata: jest.fn().mockReturnValue({
              name: "PersianAPI",
              version: "1.0",
              baseUrl: "https://studio.persianapi.com",
              requiresAuth: true,
              rateLimitPerSecond: 0.2,
            }),
            validateApiKey: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    factory = module.get<ApiProviderFactory>(ApiProviderFactory);
    persianApiProvider = module.get<PersianApiProvider>(PersianApiProvider);
  });

  it("should be defined", () => {
    expect(factory).toBeDefined();
  });

  describe("getActiveProvider", () => {
    it("should return PersianAPI provider", () => {
      const provider = factory.getActiveProvider();
      expect(provider).toBe(persianApiProvider);
    });
  });

  describe("getActiveProviderName", () => {
    it("should return persianapi", () => {
      expect(factory.getActiveProviderName()).toBe("persianapi");
    });
  });

  describe("validateActiveProvider", () => {
    it("should validate PersianAPI successfully", async () => {
      const isValid = await factory.validateActiveProvider();
      expect(isValid).toBe(true);
      expect(persianApiProvider.validateApiKey).toHaveBeenCalled();
    });

    it("should return false if validation fails", async () => {
      jest.spyOn(persianApiProvider, "validateApiKey").mockResolvedValue(false);
      const isValid = await factory.validateActiveProvider();
      expect(isValid).toBe(false);
    });

    it("should handle validation errors gracefully", async () => {
      jest
        .spyOn(persianApiProvider, "validateApiKey")
        .mockRejectedValue(new Error("Network error"));
      const isValid = await factory.validateActiveProvider();
      expect(isValid).toBe(false);
    });
  });

  describe("getMetadata", () => {
    it("should return PersianAPI metadata", () => {
      const metadata = factory.getMetadata();
      expect(metadata).toHaveProperty("name");
      expect(metadata.name).toBe("PersianAPI");
    });
  });
});
