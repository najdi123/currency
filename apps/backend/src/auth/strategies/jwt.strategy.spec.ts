import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../types/jwt-payload';
import { UserRole, UserStatus } from '../../users/schemas/user.schema';
import { Types } from 'mongoose';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: jest.Mocked<UsersService>;

  const mockUserId = new Types.ObjectId();
  const mockUser = {
    _id: mockUserId,
    email: 'test@example.com',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    firstName: 'John',
    lastName: 'Doe',
  };

  const originalEnv = process.env.JWT_SECRET;

  beforeAll(() => {
    // Set JWT_SECRET for tests
    process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-characters-for-security';
  });

  afterAll(() => {
    // Restore original JWT_SECRET
    if (originalEnv) {
      process.env.JWT_SECRET = originalEnv;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  beforeEach(async () => {
    const mockUsersService = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    usersService = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should return payload for valid active user', async () => {
      const payload: JwtPayload = {
        sub: mockUserId.toString(),
        email: 'test@example.com',
        role: UserRole.USER,
      };

      usersService.findById.mockResolvedValue(mockUser as any);

      const result = await strategy.validate(payload);

      expect(result).toEqual(payload);
      expect(usersService.findById).toHaveBeenCalledWith(payload.sub);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const payload: JwtPayload = {
        sub: 'non-existent-id',
        email: 'test@example.com',
        role: UserRole.USER,
      };

      usersService.findById.mockRejectedValue(new Error('User not found'));

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(payload)).rejects.toThrow('User not found');
    });

    it('should throw UnauthorizedException for suspended user', async () => {
      const payload: JwtPayload = {
        sub: mockUserId.toString(),
        email: 'test@example.com',
        role: UserRole.USER,
      };

      const suspendedUser = {
        ...mockUser,
        status: UserStatus.SUSPENDED,
      };

      usersService.findById.mockResolvedValue(suspendedUser as any);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(payload)).rejects.toThrow('Account is not active');
    });

    it('should throw UnauthorizedException for pending user', async () => {
      const payload: JwtPayload = {
        sub: mockUserId.toString(),
        email: 'test@example.com',
        role: UserRole.USER,
      };

      const pendingUser = {
        ...mockUser,
        status: UserStatus.PENDING,
      };

      usersService.findById.mockResolvedValue(pendingUser as any);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(payload)).rejects.toThrow('Account is not active');
    });

    it('should work for admin users', async () => {
      const payload: JwtPayload = {
        sub: mockUserId.toString(),
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      };

      const adminUser = {
        ...mockUser,
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      };

      usersService.findById.mockResolvedValue(adminUser as any);

      const result = await strategy.validate(payload);

      expect(result).toEqual(payload);
      expect(result.role).toBe(UserRole.ADMIN);
    });
  });

  describe('constructor', () => {
    it('should throw error if JWT_SECRET is not set', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      expect(() => {
        new JwtStrategy(usersService);
      }).toThrow('JWT_SECRET environment variable is not set');

      process.env.JWT_SECRET = originalSecret;
    });

    it('should throw error if JWT_SECRET is too short', () => {
      const originalSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'short';

      expect(() => {
        new JwtStrategy(usersService);
      }).toThrow('JWT_SECRET must be at least 32 characters long');

      process.env.JWT_SECRET = originalSecret;
    });

    it('should accept JWT_SECRET with exactly 32 characters', () => {
      const originalSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = '12345678901234567890123456789012'; // exactly 32 chars

      expect(() => {
        new JwtStrategy(usersService);
      }).not.toThrow();

      process.env.JWT_SECRET = originalSecret;
    });
  });
});
