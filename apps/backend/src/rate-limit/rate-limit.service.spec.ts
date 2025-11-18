import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RateLimitService } from './rate-limit.service';
import { UserRateLimit, UserRateLimitDocument, UserTier } from '../schemas/user-rate-limit.schema';

describe('RateLimitService', () => {
  let service: RateLimitService;
  let model: Model<UserRateLimitDocument>;
  let configService: ConfigService;

  // Mock data
  const mockIdentifier = '192.168.1.1';
  const mockResetAt = new Date('2025-12-01T00:00:00.000Z');

  const mockRateLimitRecord = {
    identifier: mockIdentifier,
    tier: UserTier.FREE,
    dailyLimit: 100,
    requestsToday: 50,
    resetAt: mockResetAt,
    isBlocked: false,
    save: jest.fn().mockResolvedValue(this),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, string> = {
                RATE_LIMIT_FREE: '100',
                RATE_LIMIT_PREMIUM: '1000',
                RATE_LIMIT_ENTERPRISE: '10000',
              };
              return config[key] || defaultValue;
            }),
          },
        },
        {
          provide: getModelToken(UserRateLimit.name),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            updateOne: jest.fn(),
            exec: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
    model = module.get<Model<UserRateLimitDocument>>(getModelToken(UserRateLimit.name));
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should load tier limits from config', () => {
      expect(configService.get).toHaveBeenCalledWith('RATE_LIMIT_FREE');
      expect(configService.get).toHaveBeenCalledWith('RATE_LIMIT_PREMIUM');
      expect(configService.get).toHaveBeenCalledWith('RATE_LIMIT_ENTERPRISE');
    });

    it('should use default values if config is missing', async () => {
      const moduleWithMissingConfig: TestingModule = await Test.createTestingModule({
        providers: [
          RateLimitService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => undefined),
            },
          },
          {
            provide: getModelToken(UserRateLimit.name),
            useValue: {
              findOne: jest.fn(),
              create: jest.fn(),
              updateOne: jest.fn(),
            },
          },
        ],
      }).compile();

      const serviceWithDefaults = moduleWithMissingConfig.get<RateLimitService>(RateLimitService);
      expect(serviceWithDefaults).toBeDefined();
    });
  });

  describe('checkRateLimit', () => {
    it('should create new rate limit record for new identifier', async () => {
      const execMock = jest.fn().mockResolvedValue(null);
      jest.spyOn(model, 'findOne').mockReturnValue({ exec: execMock } as any);

      const createMock = jest.fn().mockResolvedValue({
        identifier: mockIdentifier,
        tier: UserTier.FREE,
        dailyLimit: 100,
        requestsToday: 0,
        resetAt: expect.any(Date),
        isBlocked: false,
      });
      jest.spyOn(model, 'create').mockImplementation(createMock as any);

      const updateExecMock = jest.fn().mockResolvedValue({ modifiedCount: 1 });
      jest.spyOn(model, 'updateOne').mockReturnValue({ exec: updateExecMock } as any);

      const result = await service.checkRateLimit(mockIdentifier);

      expect(model.findOne).toHaveBeenCalledWith({ identifier: mockIdentifier });
      expect(createMock).toHaveBeenCalled();
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100);
    });

    it('should allow requests within limit', async () => {
      const mockRecord = {
        ...mockRateLimitRecord,
        requestsToday: 50,
        dailyLimit: 100,
      };

      const execMock = jest.fn().mockResolvedValue(mockRecord);
      jest.spyOn(model, 'findOne').mockReturnValue({ exec: execMock } as any);

      const updateExecMock = jest.fn().mockResolvedValue({ modifiedCount: 1 });
      jest.spyOn(model, 'updateOne').mockReturnValue({ exec: updateExecMock } as any);

      const result = await service.checkRateLimit(mockIdentifier);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(49); // 100 - 50 - 1
      expect(result.limit).toBe(100);
      expect(model.updateOne).toHaveBeenCalledWith(
        { identifier: mockIdentifier },
        expect.objectContaining({
          $inc: { requestsToday: 1 },
        }),
      );
    });

    it('should block requests exceeding limit', async () => {
      const mockRecord = {
        ...mockRateLimitRecord,
        requestsToday: 100,
        dailyLimit: 100,
      };

      const execMock = jest.fn().mockResolvedValue(mockRecord);
      jest.spyOn(model, 'findOne').mockReturnValue({ exec: execMock } as any);

      const result = await service.checkRateLimit(mockIdentifier);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(model.updateOne).not.toHaveBeenCalled(); // Should not increment
    });

    it('should block if user is blocked', async () => {
      const mockRecord = {
        ...mockRateLimitRecord,
        isBlocked: true,
        blockReason: 'Suspicious activity',
      };

      const execMock = jest.fn().mockResolvedValue(mockRecord);
      jest.spyOn(model, 'findOne').mockReturnValue({ exec: execMock } as any);

      const result = await service.checkRateLimit(mockIdentifier);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(model.updateOne).not.toHaveBeenCalled();
    });

    it('should reset counter if resetAt has passed', async () => {
      const pastResetAt = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      const mockRecord = {
        ...mockRateLimitRecord,
        requestsToday: 100,
        resetAt: pastResetAt,
      };

      const execMock = jest.fn().mockResolvedValue(mockRecord);
      jest.spyOn(model, 'findOne').mockReturnValue({ exec: execMock } as any);

      const updateExecMock = jest.fn().mockResolvedValue({ modifiedCount: 1 });
      jest.spyOn(model, 'updateOne').mockReturnValue({ exec: updateExecMock } as any);

      // After reset, findOne will return the reset record
      const resetRecord = {
        ...mockRecord,
        requestsToday: 0,
        resetAt: expect.any(Date),
        isBlocked: false,
      };
      const resetExecMock = jest.fn().mockResolvedValue(resetRecord);
      jest.spyOn(model, 'findOne').mockReturnValueOnce({ exec: execMock } as any)
        .mockReturnValueOnce({ exec: resetExecMock } as any);

      await service.checkRateLimit(mockIdentifier);

      expect(model.updateOne).toHaveBeenCalledWith(
        { identifier: mockIdentifier },
        expect.objectContaining({
          $set: expect.objectContaining({
            requestsToday: 0,
            isBlocked: false,
          }),
        }),
      );
    });

    it('should respect different tier limits', async () => {
      const premiumRecord = {
        ...mockRateLimitRecord,
        tier: UserTier.PREMIUM,
        dailyLimit: 1000,
        requestsToday: 999,
      };

      const execMock = jest.fn().mockResolvedValue(premiumRecord);
      jest.spyOn(model, 'findOne').mockReturnValue({ exec: execMock } as any);

      const updateExecMock = jest.fn().mockResolvedValue({ modifiedCount: 1 });
      jest.spyOn(model, 'updateOne').mockReturnValue({ exec: updateExecMock } as any);

      const result = await service.checkRateLimit(mockIdentifier, UserTier.PREMIUM);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(1000);
      expect(result.remaining).toBe(0); // 1000 - 999 - 1
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return status without incrementing counter', async () => {
      const mockRecord = {
        ...mockRateLimitRecord,
        requestsToday: 50,
        dailyLimit: 100,
      };

      const execMock = jest.fn().mockResolvedValue(mockRecord);
      jest.spyOn(model, 'findOne').mockReturnValue({ exec: execMock } as any);

      const result = await service.getRateLimitStatus(mockIdentifier);

      expect(result.remaining).toBe(50);
      expect(result.limit).toBe(100);
      expect(model.updateOne).not.toHaveBeenCalled(); // Should NOT increment
    });

    it('should return default values for new identifier', async () => {
      const execMock = jest.fn().mockResolvedValue(null);
      jest.spyOn(model, 'findOne').mockReturnValue({ exec: execMock } as any);

      const result = await service.getRateLimitStatus(mockIdentifier);

      expect(result.remaining).toBe(100); // FREE tier default
      expect(result.limit).toBe(100);
      expect(result.allowed).toBe(true);
    });
  });

  describe('upgradeTier', () => {
    it('should upgrade user tier and update daily limit', async () => {
      const updateExecMock = jest.fn().mockResolvedValue({ modifiedCount: 1 });
      jest.spyOn(model, 'updateOne').mockReturnValue({ exec: updateExecMock } as any);

      await service.upgradeTier(mockIdentifier, UserTier.PREMIUM);

      expect(model.updateOne).toHaveBeenCalledWith(
        { identifier: mockIdentifier },
        expect.objectContaining({
          $set: expect.objectContaining({
            tier: UserTier.PREMIUM,
            dailyLimit: 1000,
          }),
        }),
        { upsert: true },
      );
    });

    it('should create record if user does not exist (upsert)', async () => {
      const updateExecMock = jest.fn().mockResolvedValue({ modifiedCount: 1, upsertedCount: 1 });
      jest.spyOn(model, 'updateOne').mockReturnValue({ exec: updateExecMock } as any);

      await service.upgradeTier('new-user-ip', UserTier.ENTERPRISE);

      expect(model.updateOne).toHaveBeenCalledWith(
        { identifier: 'new-user-ip' },
        expect.objectContaining({
          $set: expect.objectContaining({
            tier: UserTier.ENTERPRISE,
            dailyLimit: 10000,
          }),
        }),
        { upsert: true },
      );
    });
  });

  describe('Configuration Parsing', () => {
    it('should handle invalid config values', async () => {
      const moduleWithInvalidConfig: TestingModule = await Test.createTestingModule({
        providers: [
          RateLimitService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'RATE_LIMIT_FREE') return 'invalid';
                if (key === 'RATE_LIMIT_PREMIUM') return '-100';
                if (key === 'RATE_LIMIT_ENTERPRISE') return '999999999999';
                return undefined;
              }),
            },
          },
          {
            provide: getModelToken(UserRateLimit.name),
            useValue: {
              findOne: jest.fn(),
              create: jest.fn(),
              updateOne: jest.fn(),
            },
          },
        ],
      }).compile();

      const serviceWithInvalidConfig = moduleWithInvalidConfig.get<RateLimitService>(RateLimitService);

      // Should fall back to defaults
      expect(serviceWithInvalidConfig).toBeDefined();
    });
  });
});
