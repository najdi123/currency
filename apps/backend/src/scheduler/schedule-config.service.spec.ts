import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ScheduleConfigService } from "./schedule-config.service";
import moment from "moment-timezone";

describe("ScheduleConfigService", () => {
  let service: ScheduleConfigService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                SCHEDULER_PEAK_INTERVAL: "10",
                SCHEDULER_NORMAL_INTERVAL: "60",
                SCHEDULER_WEEKEND_INTERVAL: "120",
                SCHEDULER_PEAK_START_HOUR: "8",
                SCHEDULER_PEAK_END_HOUR: "14",
                SCHEDULER_TIMEZONE: "Asia/Tehran",
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ScheduleConfigService>(ScheduleConfigService);
    configService = module.get<ConfigService>(ConfigService);

    // Use fake timers for time-dependent tests
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("Service Initialization", () => {
    it("should be defined", () => {
      expect(service).toBeDefined();
    });

    it("should load configuration from ConfigService", () => {
      const config = service.getConfiguration();

      expect(config.peakHours.interval).toBe(10);
      expect(config.normalHours.interval).toBe(60);
      expect(config.weekendHours.interval).toBe(120);
      expect(config.peakHours.startHour).toBe(8);
      expect(config.peakHours.endHour).toBe(14);
      expect(config.timezone).toBe("Asia/Tehran");
    });

    it("should have correct peak days (Mon, Tue, Wed)", () => {
      const config = service.getConfiguration();
      expect(config.peakHours.days).toEqual([1, 2, 3]);
    });

    it("should have correct weekend days (Thu, Fri)", () => {
      const config = service.getConfiguration();
      expect(config.weekendHours.days).toEqual([4, 5]);
    });
  });

  describe("Peak Hours Detection", () => {
    it("should detect peak hours on Monday at 10 AM Tehran", () => {
      // Set system time to Monday, 10:00 AM Tehran (2025-01-20 10:00:00 Tehran = 2025-01-20 06:30:00 UTC)
      jest.setSystemTime(new Date("2025-01-20T06:30:00.000Z"));

      expect(service.isCurrentlyPeakHours()).toBe(true);
      expect(service.getCurrentSchedulePeriod()).toBe("Peak Hours");
      expect(service.getCurrentScheduleInterval()).toBe(10);
    });

    it("should detect peak hours on Tuesday at 8 AM Tehran (start of peak)", () => {
      // Tuesday, 8:00 AM Tehran = 04:30 UTC
      jest.setSystemTime(new Date("2025-01-21T04:30:00.000Z"));

      expect(service.isCurrentlyPeakHours()).toBe(true);
      expect(service.getCurrentScheduleInterval()).toBe(10);
    });

    it("should detect peak hours on Wednesday at 1:59 PM Tehran (end of peak)", () => {
      // Wednesday, 1:59 PM Tehran (13:59) = 10:29 UTC
      jest.setSystemTime(new Date("2025-01-22T10:29:00.000Z"));

      expect(service.isCurrentlyPeakHours()).toBe(true);
      expect(service.getCurrentScheduleInterval()).toBe(10);
    });

    it("should NOT detect peak hours at 2 PM Tehran (peak ends)", () => {
      // Monday, 2:00 PM Tehran (14:00) = 10:30 UTC
      jest.setSystemTime(new Date("2025-01-20T10:30:00.000Z"));

      expect(service.isCurrentlyPeakHours()).toBe(false);
      expect(service.getCurrentSchedulePeriod()).toBe("Normal Hours");
      expect(service.getCurrentScheduleInterval()).toBe(60);
    });

    it("should NOT detect peak hours at 7 AM Tehran (before peak)", () => {
      // Tuesday, 7:00 AM Tehran = 03:30 UTC
      jest.setSystemTime(new Date("2025-01-21T03:30:00.000Z"));

      expect(service.isCurrentlyPeakHours()).toBe(false);
      expect(service.getCurrentScheduleInterval()).toBe(60);
    });

    it("should NOT detect peak hours on weekend even during peak time", () => {
      // Thursday, 10:00 AM Tehran = 06:30 UTC
      jest.setSystemTime(new Date("2025-01-23T06:30:00.000Z"));

      expect(service.isCurrentlyPeakHours()).toBe(false);
      expect(service.isCurrentlyWeekend()).toBe(true);
    });
  });

  describe("Weekend Detection", () => {
    it("should detect weekend on Thursday", () => {
      // Thursday 10:00 AM Tehran
      jest.setSystemTime(new Date("2025-01-23T06:30:00.000Z"));

      expect(service.isCurrentlyWeekend()).toBe(true);
      expect(service.getCurrentSchedulePeriod()).toBe("Weekend");
      expect(service.getCurrentScheduleInterval()).toBe(120);
    });

    it("should detect weekend on Friday", () => {
      // Friday 3:00 PM Tehran = 11:30 UTC
      jest.setSystemTime(new Date("2025-01-24T11:30:00.000Z"));

      expect(service.isCurrentlyWeekend()).toBe(true);
      expect(service.getCurrentSchedulePeriod()).toBe("Weekend");
      expect(service.getCurrentScheduleInterval()).toBe(120);
    });

    it("should NOT detect weekend on Saturday", () => {
      // Saturday 10:00 AM Tehran = 06:30 UTC
      jest.setSystemTime(new Date("2025-01-25T06:30:00.000Z"));

      expect(service.isCurrentlyWeekend()).toBe(false);
    });

    it("should NOT detect weekend on Monday", () => {
      // Monday 10:00 AM Tehran
      jest.setSystemTime(new Date("2025-01-20T06:30:00.000Z"));

      expect(service.isCurrentlyWeekend()).toBe(false);
    });
  });

  describe("Normal Hours Detection", () => {
    it("should detect normal hours on Monday at 7 AM", () => {
      // Monday, 7:00 AM Tehran = 03:30 UTC
      jest.setSystemTime(new Date("2025-01-20T03:30:00.000Z"));

      expect(service.isCurrentlyPeakHours()).toBe(false);
      expect(service.isCurrentlyWeekend()).toBe(false);
      expect(service.getCurrentSchedulePeriod()).toBe("Normal Hours");
      expect(service.getCurrentScheduleInterval()).toBe(60);
    });

    it("should detect normal hours on Wednesday at 3 PM", () => {
      // Wednesday, 3:00 PM Tehran (15:00) = 11:30 UTC
      jest.setSystemTime(new Date("2025-01-22T11:30:00.000Z"));

      expect(service.getCurrentSchedulePeriod()).toBe("Normal Hours");
      expect(service.getCurrentScheduleInterval()).toBe(60);
    });

    it("should detect normal hours on Monday at midnight", () => {
      // Monday, 12:00 AM Tehran = Sunday 20:30 UTC
      jest.setSystemTime(new Date("2025-01-19T20:30:00.000Z"));

      expect(service.getCurrentSchedulePeriod()).toBe("Normal Hours");
      expect(service.getCurrentScheduleInterval()).toBe(60);
    });
  });

  describe("Schedule Interval Calculation", () => {
    it("should return 10 minutes during peak hours", () => {
      // Monday 10 AM Tehran
      jest.setSystemTime(new Date("2025-01-20T06:30:00.000Z"));

      expect(service.getCurrentScheduleInterval()).toBe(10);
    });

    it("should return 60 minutes during normal hours", () => {
      // Monday 4 PM Tehran = 12:30 UTC
      jest.setSystemTime(new Date("2025-01-20T12:30:00.000Z"));

      expect(service.getCurrentScheduleInterval()).toBe(60);
    });

    it("should return 120 minutes during weekends", () => {
      // Thursday 10 AM Tehran
      jest.setSystemTime(new Date("2025-01-23T06:30:00.000Z"));

      expect(service.getCurrentScheduleInterval()).toBe(120);
    });
  });

  describe("Configuration Management", () => {
    it("should return full configuration", () => {
      const config = service.getConfiguration();

      expect(config).toHaveProperty("peakHours");
      expect(config).toHaveProperty("normalHours");
      expect(config).toHaveProperty("weekendHours");
      expect(config).toHaveProperty("timezone");

      expect(config.peakHours).toHaveProperty("days");
      expect(config.peakHours).toHaveProperty("startHour");
      expect(config.peakHours).toHaveProperty("endHour");
      expect(config.peakHours).toHaveProperty("interval");
    });

    it("should update configuration at runtime", () => {
      const newConfig = {
        peakHours: {
          days: [1, 2, 3],
          startHour: 9,
          endHour: 15,
          interval: 5,
        },
      };

      service.updateConfiguration(newConfig);

      const updatedConfig = service.getConfiguration();
      expect(updatedConfig.peakHours.startHour).toBe(9);
      expect(updatedConfig.peakHours.endHour).toBe(15);
      expect(updatedConfig.peakHours.interval).toBe(5);
    });

    it("should preserve other config when partially updating", () => {
      const originalConfig = service.getConfiguration();

      service.updateConfiguration({
        peakHours: {
          ...originalConfig.peakHours,
          interval: 15,
        },
      });

      const updatedConfig = service.getConfiguration();
      expect(updatedConfig.peakHours.interval).toBe(15);
      expect(updatedConfig.normalHours.interval).toBe(60); // Unchanged
      expect(updatedConfig.weekendHours.interval).toBe(120); // Unchanged
    });
  });

  describe("Edge Cases", () => {
    it("should handle Sunday correctly (not weekend in Iran)", () => {
      // Sunday 10 AM Tehran = 06:30 UTC
      jest.setSystemTime(new Date("2025-01-19T06:30:00.000Z"));

      expect(service.isCurrentlyWeekend()).toBe(false);
      // Sunday is day 0, not in peak days [1,2,3]
      expect(service.getCurrentSchedulePeriod()).toBe("Normal Hours");
    });

    it("should handle Saturday correctly (workday in Iran)", () => {
      // Saturday 10 AM Tehran = 06:30 UTC
      jest.setSystemTime(new Date("2025-01-18T06:30:00.000Z"));

      expect(service.isCurrentlyWeekend()).toBe(false);
      // Saturday is day 6, not in peak days [1,2,3]
      expect(service.getCurrentSchedulePeriod()).toBe("Normal Hours");
    });

    it("should handle exact peak start boundary", () => {
      // Exactly 8:00:00 AM Tehran = 04:30 UTC
      jest.setSystemTime(new Date("2025-01-20T04:30:00.000Z"));

      expect(service.isCurrentlyPeakHours()).toBe(true);
    });

    it("should handle exact peak end boundary", () => {
      // Exactly 2:00:00 PM (14:00:00) Tehran = 10:30 UTC
      jest.setSystemTime(new Date("2025-01-20T10:30:00.000Z"));

      expect(service.isCurrentlyPeakHours()).toBe(false);
    });
  });

  describe("Custom Configuration via Environment", () => {
    it("should use custom peak interval from environment", async () => {
      const customConfigService = {
        get: jest.fn((key: string, defaultValue?: string) => {
          if (key === "SCHEDULER_PEAK_INTERVAL") return "5";
          if (key === "SCHEDULER_NORMAL_INTERVAL") return "60";
          if (key === "SCHEDULER_WEEKEND_INTERVAL") return "120";
          if (key === "SCHEDULER_PEAK_START_HOUR") return "8";
          if (key === "SCHEDULER_PEAK_END_HOUR") return "14";
          if (key === "SCHEDULER_TIMEZONE") return "Asia/Tehran";
          return defaultValue;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ScheduleConfigService,
          {
            provide: ConfigService,
            useValue: customConfigService,
          },
        ],
      }).compile();

      const customService = module.get<ScheduleConfigService>(
        ScheduleConfigService,
      );
      const config = customService.getConfiguration();

      expect(config.peakHours.interval).toBe(5);
    });

    it("should use custom timezone from environment", async () => {
      const customConfigService = {
        get: jest.fn((key: string, defaultValue?: string) => {
          if (key === "SCHEDULER_TIMEZONE") return "UTC";
          if (key === "SCHEDULER_PEAK_INTERVAL") return "10";
          if (key === "SCHEDULER_NORMAL_INTERVAL") return "60";
          if (key === "SCHEDULER_WEEKEND_INTERVAL") return "120";
          if (key === "SCHEDULER_PEAK_START_HOUR") return "8";
          if (key === "SCHEDULER_PEAK_END_HOUR") return "14";
          return defaultValue;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ScheduleConfigService,
          {
            provide: ConfigService,
            useValue: customConfigService,
          },
        ],
      }).compile();

      const customService = module.get<ScheduleConfigService>(
        ScheduleConfigService,
      );
      const config = customService.getConfiguration();

      expect(config.timezone).toBe("UTC");
    });
  });

  describe("Integration Scenarios", () => {
    it("should transition from normal to peak hours correctly", () => {
      // Start at 7:59 AM Tehran = 04:29 UTC
      jest.setSystemTime(new Date("2025-01-20T04:29:00.000Z"));
      expect(service.getCurrentScheduleInterval()).toBe(60);

      // Move to 8:00 AM Tehran = 04:30 UTC
      jest.setSystemTime(new Date("2025-01-20T04:30:00.000Z"));
      expect(service.getCurrentScheduleInterval()).toBe(10);
    });

    it("should transition from peak to normal hours correctly", () => {
      // Start at 1:59 PM Tehran = 10:29 UTC
      jest.setSystemTime(new Date("2025-01-20T10:29:00.000Z"));
      expect(service.getCurrentScheduleInterval()).toBe(10);

      // Move to 2:00 PM Tehran = 10:30 UTC
      jest.setSystemTime(new Date("2025-01-20T10:30:00.000Z"));
      expect(service.getCurrentScheduleInterval()).toBe(60);
    });

    it("should transition from weekday to weekend correctly", () => {
      // Wednesday 11:59 PM Tehran = 20:29 UTC
      jest.setSystemTime(new Date("2025-01-22T20:29:00.000Z"));
      expect(service.getCurrentScheduleInterval()).toBe(60);

      // Thursday 12:00 AM Tehran = 20:30 UTC
      jest.setSystemTime(new Date("2025-01-22T20:30:00.000Z"));
      expect(service.getCurrentScheduleInterval()).toBe(120);
    });
  });
});
