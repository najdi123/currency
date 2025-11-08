import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../../users/schemas/user.schema';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (user?: any): ExecutionContext => {
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user,
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  describe('canActivate', () => {
    it('should allow access when user has required role', () => {
      const mockContext = createMockExecutionContext({ role: UserRole.ADMIN });
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalled();
    });

    it('should deny access when user lacks required role', () => {
      const mockContext = createMockExecutionContext({ role: UserRole.USER });
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow('Insufficient role');
    });

    it('should allow access when no roles are required', () => {
      const mockContext = createMockExecutionContext({ role: UserRole.USER });
      reflector.getAllAndOverride.mockReturnValue(null);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should allow access when roles array is empty', () => {
      const mockContext = createMockExecutionContext({ role: UserRole.USER });
      reflector.getAllAndOverride.mockReturnValue([]);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should work with multiple roles', () => {
      const mockContext = createMockExecutionContext({ role: UserRole.USER });
      reflector.getAllAndOverride.mockReturnValue([UserRole.USER, UserRole.ADMIN]);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should deny access when user is undefined', () => {
      const mockContext = createMockExecutionContext(undefined);
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should deny access when user has no role', () => {
      const mockContext = createMockExecutionContext({ email: 'test@example.com' });
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should allow admin access to admin-only routes', () => {
      const mockContext = createMockExecutionContext({ role: UserRole.ADMIN });
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should deny regular user access to admin-only routes', () => {
      const mockContext = createMockExecutionContext({ role: UserRole.USER });
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should check roles from both handler and class', () => {
      const mockContext = createMockExecutionContext({ role: UserRole.ADMIN });
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

      guard.canActivate(mockContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        'roles',
        [mockContext.getHandler(), mockContext.getClass()]
      );
    });
  });
});
