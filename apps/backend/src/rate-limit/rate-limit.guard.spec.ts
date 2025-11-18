import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
import { UserTier } from '../schemas/user-rate-limit.schema';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let rateLimitService: RateLimitService;
  let configService: ConfigService;
  let reflector: Reflector;

  const mockRateLimitService = {
    checkRateLimit: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockReflector = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        {
          provide: RateLimitService,
          useValue: mockRateLimitService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<RateLimitGuard>(RateLimitGuard);
    rateLimitService = module.get<RateLimitService>(RateLimitService);
    configService = module.get<ConfigService>(ConfigService);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (options: {
    ip?: string;
    forwardedFor?: string;
    userTier?: string;
  }): ExecutionContext => {
    const request = {
      ip: options.ip || '192.168.1.1',
      headers: options.forwardedFor ? { 'x-forwarded-for': options.forwardedFor } : {},
      connection: { remoteAddress: options.ip || '192.168.1.1' },
      user: options.userTier ? { tier: options.userTier } : undefined,
    };

    // Create response mock once and reuse it
    const response = {
      set: jest.fn(),
      setHeader: jest.fn(),
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  };

  describe('IP Extraction', () => {
    it('should use direct IP when TRUST_PROXY is false', async () => {
      mockConfigService.get.mockReturnValue('false');
      mockRateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        limit: 100,
        resetAt: new Date(),
      });

      const context = createMockExecutionContext({
        ip: '192.168.1.1',
        forwardedFor: '10.0.0.1, 172.16.0.1',
      });

      await guard.canActivate(context);

      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'ip:192.168.1.1',
        UserTier.FREE,
      );
    });

    it('should use X-Forwarded-For when TRUST_PROXY is true', async () => {
      mockConfigService.get.mockReturnValue('true');
      mockRateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        limit: 100,
        resetAt: new Date(),
      });

      const context = createMockExecutionContext({
        ip: '192.168.1.1',
        forwardedFor: '10.0.0.1, 172.16.0.1',
      });

      await guard.canActivate(context);

      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'ip:10.0.0.1', // First IP from X-Forwarded-For
        UserTier.FREE,
      );
    });

    it('should handle missing X-Forwarded-For header', async () => {
      mockConfigService.get.mockReturnValue('true');
      mockRateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        limit: 100,
        resetAt: new Date(),
      });

      const context = createMockExecutionContext({
        ip: '192.168.1.1',
      });

      await guard.canActivate(context);

      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'ip:192.168.1.1', // Falls back to direct IP
        UserTier.FREE,
      );
    });

    it('should handle malformed X-Forwarded-For header', async () => {
      mockConfigService.get.mockReturnValue('true');
      mockRateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        limit: 100,
        resetAt: new Date(),
      });

      const context = createMockExecutionContext({
        ip: '192.168.1.1',
        forwardedFor: '   ,  , ',
      });

      await guard.canActivate(context);

      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'ip:192.168.1.1', // Falls back to direct IP
        UserTier.FREE,
      );
    });
  });

  describe('User Tier Validation', () => {
    it('should use FREE tier by default', async () => {
      mockConfigService.get.mockReturnValue('false');
      mockRateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        limit: 100,
        resetAt: new Date(),
      });

      const context = createMockExecutionContext({});

      await guard.canActivate(context);

      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        UserTier.FREE,
      );
    });

    it('should use user tier from request.user if available', async () => {
      mockConfigService.get.mockReturnValue('false');
      mockRateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 999,
        limit: 1000,
        resetAt: new Date(),
      });

      const context = createMockExecutionContext({
        userTier: UserTier.PREMIUM,
      });

      await guard.canActivate(context);

      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        UserTier.PREMIUM,
      );
    });

    it('should validate user tier is valid enum value', async () => {
      mockConfigService.get.mockReturnValue('false');
      mockRateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        limit: 100,
        resetAt: new Date(),
      });

      const context = createMockExecutionContext({
        userTier: 'invalid-tier' as any,
      });

      await guard.canActivate(context);

      // Should fall back to FREE tier for invalid values
      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        UserTier.FREE,
      );
    });
  });

  describe('Rate Limit Enforcement', () => {
    it('should allow requests within limit', async () => {
      mockConfigService.get.mockReturnValue('false');
      mockRateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        limit: 100,
        resetAt: new Date('2025-12-01T00:00:00Z'),
      });

      const context = createMockExecutionContext({});
      const response = context.switchToHttp().getResponse();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 99);
      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });

    it('should block requests exceeding limit', async () => {
      mockConfigService.get.mockReturnValue('false');
      mockRateLimitService.checkRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        limit: 100,
        resetAt: new Date('2025-12-01T00:00:00Z'),
        retryAfter: 3600,
      });

      const context = createMockExecutionContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toThrow('Rate limit exceeded');

      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const httpError = error as HttpException;
        expect(httpError.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(httpError.getResponse()).toMatchObject({
          statusCode: 429,
          message: 'Rate limit exceeded',
          remaining: 0,
          limit: 100,
          retryAfter: 3600,
          resetAt: expect.any(Date),
        });
      }
    });

    it('should set Retry-After header when rate limited', async () => {
      mockConfigService.get.mockReturnValue('false');
      mockRateLimitService.checkRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        limit: 100,
        resetAt: new Date('2025-12-01T00:00:00Z'),
        retryAfter: 3600,
      });

      const context = createMockExecutionContext({});
      const response = context.switchToHttp().getResponse();

      try {
        await guard.canActivate(context);
      } catch (error) {
        // Expected to throw
      }

      expect(response.setHeader).toHaveBeenCalledWith('Retry-After', 3600);
    });
  });

  describe('Error Handling - Fail Open', () => {
    it('should allow request if rate limit service throws error', async () => {
      mockConfigService.get.mockReturnValue('false');
      mockRateLimitService.checkRateLimit.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const context = createMockExecutionContext({});

      const result = await guard.canActivate(context);

      expect(result).toBe(true); // Fail open - allow request
    });

    it('should log error when rate limit service fails', async () => {
      mockConfigService.get.mockReturnValue('false');
      mockRateLimitService.checkRateLimit.mockRejectedValue(
        new Error('MongoDB timeout'),
      );

      const loggerSpy = jest.spyOn((guard as any).logger, 'error');

      const context = createMockExecutionContext({});
      await guard.canActivate(context);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit check failed'),
        expect.any(Error),
      );
    });
  });

  describe('Response Headers', () => {
    it('should set all rate limit headers', async () => {
      mockConfigService.get.mockReturnValue('false');
      const resetAt = new Date('2025-12-01T00:00:00Z');
      mockRateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 50,
        limit: 100,
        resetAt,
      });

      const context = createMockExecutionContext({});
      const response = context.switchToHttp().getResponse();

      await guard.canActivate(context);

      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 50);
      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', resetAt.toISOString());
    });

    it('should include tier information in headers', async () => {
      mockConfigService.get.mockReturnValue('false');
      mockRateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 999,
        limit: 1000,
        resetAt: new Date(),
      });

      const context = createMockExecutionContext({
        userTier: UserTier.PREMIUM,
      });

      await guard.canActivate(context);

      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        UserTier.PREMIUM,
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing request.ip', async () => {
      mockConfigService.get.mockReturnValue('false');
      mockRateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        limit: 100,
        resetAt: new Date(),
      });

      const request = {
        headers: {},
        connection: {},
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({ set: jest.fn(), setHeader: jest.fn() }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;

      await guard.canActivate(context);

      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'ip:unknown',
        UserTier.FREE,
      );
    });

    it('should handle array X-Forwarded-For header', async () => {
      mockConfigService.get.mockReturnValue('true');
      mockRateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        limit: 100,
        resetAt: new Date(),
      });

      const request = {
        ip: '192.168.1.1',
        headers: {
          'x-forwarded-for': ['10.0.0.1', '172.16.0.1'] as any, // Array instead of string
        },
        connection: { remoteAddress: '192.168.1.1' },
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({ set: jest.fn(), setHeader: jest.fn() }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;

      await guard.canActivate(context);

      // Should fall back to direct IP when header is not a string
      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'ip:192.168.1.1',
        UserTier.FREE,
      );
    });
  });
});
