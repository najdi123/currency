import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { NavasanSchedulerService } from "./navasan-scheduler.service";
import { MarketDataOrchestratorService } from "../market-data/market-data-orchestrator.service";
import { ScheduleConfigService } from "./schedule-config.service";
import { SchedulerRegistry } from "@nestjs/schedule";

describe("NavasanSchedulerService", () => {
  let service: NavasanSchedulerService;
  let marketDataService: jest.Mocked<MarketDataOrchestratorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NavasanSchedulerService,
        {
          provide: MarketDataOrchestratorService,
          useValue: {
            forceFetchAndCache: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                SCHEDULER_ENABLED: "false", // Disabled to prevent auto-init
                SCHEDULER_INTERVAL_MINUTES: "60",
                SCHEDULER_TIMEZONE: "UTC",
                SCHEDULER_USE_DYNAMIC: "false",
              };
              return config[key] || defaultValue;
            }),
          },
        },
        {
          provide: ScheduleConfigService,
          useValue: {
            getCurrentSchedulePeriod: jest.fn().mockReturnValue("peak"),
            getCurrentScheduleInterval: jest.fn().mockReturnValue(30),
            getNextScheduledTime: jest.fn().mockReturnValue(new Date()),
            getTehranTime: jest.fn().mockReturnValue({ format: () => "2024-01-01 12:00:00" }),
            isCurrentlyPeakHours: jest.fn().mockReturnValue(true),
            isCurrentlyWeekend: jest.fn().mockReturnValue(false),
            getMinutesUntilNextPeriodChange: jest.fn().mockReturnValue(30),
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
    marketDataService = module.get(MarketDataOrchestratorService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("fetchAllData", () => {
    it("should fetch all categories on scheduled run", async () => {
      marketDataService.forceFetchAndCache.mockResolvedValue({ success: true });

      await service.fetchAllData();

      expect(marketDataService.forceFetchAndCache).toHaveBeenCalledWith(
        "currencies",
      );
      expect(marketDataService.forceFetchAndCache).toHaveBeenCalledWith("crypto");
      expect(marketDataService.forceFetchAndCache).toHaveBeenCalledWith("gold");
      expect(marketDataService.forceFetchAndCache).toHaveBeenCalledTimes(3);
    });

    it("should handle API failures gracefully", async () => {
      marketDataService.forceFetchAndCache
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: "API key expired" })
        .mockResolvedValueOnce({ success: true });

      await service.fetchAllData();

      // Should complete without throwing
      expect(marketDataService.forceFetchAndCache).toHaveBeenCalledTimes(3);
    });

    it("should prevent concurrent executions", async () => {
      marketDataService.forceFetchAndCache.mockImplementation(
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
      expect(marketDataService.forceFetchAndCache).toHaveBeenCalledTimes(3);
    });
  });

  describe("triggerManualFetch", () => {
    it("should trigger manual fetch successfully", async () => {
      marketDataService.forceFetchAndCache.mockResolvedValue({ success: true });

      const result = await service.triggerManualFetch();

      expect(result.success).toBe(true);
      expect(result.message).toContain("Manual fetch completed");
    });
  });

  describe("getSchedulerConfig", () => {
    it("should return current scheduler configuration", () => {
      const config = service.getSchedulerConfig();

      expect(config).toHaveProperty("enabled");
      expect(config).toHaveProperty("useDynamicScheduling");
      expect(config).toHaveProperty("nextRun");
    });
  });
});
