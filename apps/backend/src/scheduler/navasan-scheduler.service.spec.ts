import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { NavasanSchedulerService } from "./navasan-scheduler.service";
import { NavasanService } from "../navasan/navasan.service";
import { SchedulerRegistry } from "@nestjs/schedule";

describe("NavasanSchedulerService", () => {
  let service: NavasanSchedulerService;
  let navasanService: jest.Mocked<NavasanService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NavasanSchedulerService,
        {
          provide: NavasanService,
          useValue: {
            forceFetchAndCache: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                SCHEDULER_ENABLED: "true",
                SCHEDULER_INTERVAL_MINUTES: "60",
                SCHEDULER_TIMEZONE: "UTC",
              };
              return config[key] || defaultValue;
            }),
          },
        },
        {
          provide: SchedulerRegistry,
          useValue: {
            getCronJob: jest.fn(),
            addCronJob: jest.fn(),
            deleteCronJob: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NavasanSchedulerService>(NavasanSchedulerService);
    navasanService = module.get(NavasanService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("fetchAllData", () => {
    it("should fetch all categories on scheduled run", async () => {
      navasanService.forceFetchAndCache.mockResolvedValue({ success: true });

      await service.fetchAllData();

      expect(navasanService.forceFetchAndCache).toHaveBeenCalledWith(
        "currencies",
      );
      expect(navasanService.forceFetchAndCache).toHaveBeenCalledWith("crypto");
      expect(navasanService.forceFetchAndCache).toHaveBeenCalledWith("gold");
      expect(navasanService.forceFetchAndCache).toHaveBeenCalledTimes(3);
    });

    it("should handle API failures gracefully", async () => {
      navasanService.forceFetchAndCache
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: "API key expired" })
        .mockResolvedValueOnce({ success: true });

      await service.fetchAllData();

      // Should complete without throwing
      expect(navasanService.forceFetchAndCache).toHaveBeenCalledTimes(3);
    });

    it("should prevent concurrent executions", async () => {
      navasanService.forceFetchAndCache.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ success: true }), 100),
          ),
      );

      // Start first fetch
      const firstFetch = service.fetchAllData();

      // Try to start second fetch immediately
      await service.fetchAllData(); // Should be skipped

      await firstFetch;

      // Should only be called once (3 times total for one execution)
      expect(navasanService.forceFetchAndCache).toHaveBeenCalledTimes(3);
    });
  });

  describe("triggerManualFetch", () => {
    it("should trigger manual fetch successfully", async () => {
      navasanService.forceFetchAndCache.mockResolvedValue({ success: true });

      const result = await service.triggerManualFetch();

      expect(result.success).toBe(true);
      expect(result.message).toContain("Manual fetch completed");
    });
  });

  describe("getSchedulerConfig", () => {
    it("should return current scheduler configuration", () => {
      const config = service.getSchedulerConfig();

      expect(config).toHaveProperty("enabled");
      expect(config).toHaveProperty("intervalMinutes");
      expect(config).toHaveProperty("timezone");
      expect(config).toHaveProperty("nextRun");
    });
  });
});
