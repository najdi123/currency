import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitController } from './rate-limit.controller';
import { RateLimitService } from './rate-limit.service';
import { UserTier } from '../schemas/user-rate-limit.schema';

describe('RateLimitController', () => {
  let controller: RateLimitController;
  let rateLimitService: RateLimitService;

  const mockRateLimitService = {
    getRateLimitStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RateLimitController],
      providers: [
        {
          provide: RateLimitService,
          useValue: mockRateLimitService,
        },
      ],
    }).compile();

    controller = module.get<RateLimitController>(RateLimitController);
    rateLimitService = module.get<RateLimitService>(RateLimitService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /rate-limit/status', () => {
    it('should return rate limit status for anonymous user', async () => {
      const mockRequest = {
        ip: '192.168.1.1',
      };

      mockRateLimitService.getRateLimitStatus.mockResolvedValue({
        allowed: true,
        remaining: 95,
        limit: 100,
        resetAt: new Date('2025-12-01T00:00:00Z'),
      });

      const result = await controller.getStatus(mockRequest);

      expect(rateLimitService.getRateLimitStatus).toHaveBeenCalledWith('192.168.1.1');
      expect(result).toEqual({
        tier: UserTier.FREE,
        allowed: true,
        remaining: 95,
        limit: 100,
        resetAt: expect.any(Date),
        percentage: 95, // (95/100) * 100
      });
    });

    it('should return rate limit status for authenticated user', async () => {
      const mockRequest = {
        ip: '192.168.1.1',
        user: {
          id: 'user-123',
          tier: UserTier.PREMIUM,
        },
      };

      mockRateLimitService.getRateLimitStatus.mockResolvedValue({
        allowed: true,
        remaining: 500,
        limit: 1000,
        resetAt: new Date('2025-12-01T00:00:00Z'),
      });

      const result = await controller.getStatus(mockRequest);

      expect(rateLimitService.getRateLimitStatus).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({
        tier: UserTier.PREMIUM,
        allowed: true,
        remaining: 500,
        limit: 1000,
        resetAt: expect.any(Date),
        percentage: 50, // (500/1000) * 100
      });
    });

    it('should use "anonymous" as identifier if IP is missing', async () => {
      const mockRequest = {};

      mockRateLimitService.getRateLimitStatus.mockResolvedValue({
        allowed: true,
        remaining: 100,
        limit: 100,
        resetAt: new Date('2025-12-01T00:00:00Z'),
      });

      const result = await controller.getStatus(mockRequest);

      expect(rateLimitService.getRateLimitStatus).toHaveBeenCalledWith('anonymous');
      expect(result.tier).toBe(UserTier.FREE);
    });

    it('should calculate percentage correctly', async () => {
      const mockRequest = {
        ip: '192.168.1.1',
      };

      mockRateLimitService.getRateLimitStatus.mockResolvedValue({
        allowed: true,
        remaining: 25,
        limit: 100,
        resetAt: new Date('2025-12-01T00:00:00Z'),
      });

      const result = await controller.getStatus(mockRequest);

      expect(result.percentage).toBe(25); // (25/100) * 100
    });

    it('should handle zero remaining requests', async () => {
      const mockRequest = {
        ip: '192.168.1.1',
      };

      mockRateLimitService.getRateLimitStatus.mockResolvedValue({
        allowed: false,
        remaining: 0,
        limit: 100,
        resetAt: new Date('2025-12-01T00:00:00Z'),
        retryAfter: 3600,
      });

      const result = await controller.getStatus(mockRequest);

      expect(result.percentage).toBe(0); // (0/100) * 100
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(3600);
    });

    it('should handle enterprise tier', async () => {
      const mockRequest = {
        ip: '192.168.1.1',
        user: {
          id: 'enterprise-user',
          tier: UserTier.ENTERPRISE,
        },
      };

      mockRateLimitService.getRateLimitStatus.mockResolvedValue({
        allowed: true,
        remaining: 9500,
        limit: 10000,
        resetAt: new Date('2025-12-01T00:00:00Z'),
      });

      const result = await controller.getStatus(mockRequest);

      expect(rateLimitService.getRateLimitStatus).toHaveBeenCalledWith('enterprise-user');
      expect(result.tier).toBe(UserTier.ENTERPRISE);
      expect(result.percentage).toBe(95); // (9500/10000) * 100
    });

    it('should return correct response structure', async () => {
      const mockRequest = {
        ip: '192.168.1.1',
      };

      const mockResetAt = new Date('2025-12-01T00:00:00Z');
      mockRateLimitService.getRateLimitStatus.mockResolvedValue({
        allowed: true,
        remaining: 75,
        limit: 100,
        resetAt: mockResetAt,
      });

      const result = await controller.getStatus(mockRequest);

      expect(result).toHaveProperty('tier');
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('resetAt');
      expect(result).toHaveProperty('percentage');

      expect(typeof result.tier).toBe('string');
      expect(typeof result.allowed).toBe('boolean');
      expect(typeof result.remaining).toBe('number');
      expect(typeof result.limit).toBe('number');
      expect(result.resetAt).toBeInstanceOf(Date);
      expect(typeof result.percentage).toBe('number');
    });

    it('should handle service errors gracefully', async () => {
      const mockRequest = {
        ip: '192.168.1.1',
      };

      mockRateLimitService.getRateLimitStatus.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(controller.getStatus(mockRequest)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should prioritize user.id over IP for authenticated users', async () => {
      const mockRequest = {
        ip: '192.168.1.1',
        user: {
          id: 'user-456',
          tier: UserTier.FREE,
        },
      };

      mockRateLimitService.getRateLimitStatus.mockResolvedValue({
        allowed: true,
        remaining: 80,
        limit: 100,
        resetAt: new Date('2025-12-01T00:00:00Z'),
      });

      await controller.getStatus(mockRequest);

      expect(rateLimitService.getRateLimitStatus).toHaveBeenCalledWith('user-456');
      expect(rateLimitService.getRateLimitStatus).not.toHaveBeenCalledWith('192.168.1.1');
    });

    it('should round percentage to nearest integer', async () => {
      const mockRequest = {
        ip: '192.168.1.1',
      };

      mockRateLimitService.getRateLimitStatus.mockResolvedValue({
        allowed: true,
        remaining: 33,
        limit: 100,
        resetAt: new Date('2025-12-01T00:00:00Z'),
      });

      const result = await controller.getStatus(mockRequest);

      expect(result.percentage).toBe(33); // Math.round(33/100 * 100) = 33
      expect(Number.isInteger(result.percentage)).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should inject RateLimitService', () => {
      expect(rateLimitService).toBeDefined();
    });
  });
});
