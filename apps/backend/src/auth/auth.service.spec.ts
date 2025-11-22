import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { getModelToken } from "@nestjs/mongoose";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UserRole, UserStatus } from "../users/schemas/user.schema";
import { Types } from "mongoose";
import { AuditService } from "../common/services/audit.service";
import { EmailService } from "../common/services/email.service";

describe("AuthService", () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let auditService: jest.Mocked<AuditService>;
  let emailService: jest.Mocked<EmailService>;
  let refreshTokenModel: any;

  const mockUserId = new Types.ObjectId();
  const mockUser = {
    _id: mockUserId,
    email: "test@example.com",
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    firstName: "John",
    lastName: "Doe",
    passwordHash: "$2b$12$hashedpassword",
  };

  beforeEach(async () => {
    const mockUsersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      setLastLogin: jest.fn(),
      updatePassword: jest.fn(),
      updateLoginAttempts: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
    };

    const mockAuditService = {
      logEvent: jest.fn(),
      logSuccessfulLogin: jest.fn(),
      logFailedLogin: jest.fn(),
      logUserRegistration: jest.fn(),
      logPasswordChange: jest.fn(),
      logUserUpdate: jest.fn(),
      logUserAccess: jest.fn(),
    };

    const mockEmailService = {
      sendVerificationEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
      sendWelcomeEmail: jest.fn(),
    };

    const mockRefreshTokenModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: EmailService, useValue: mockEmailService },
        {
          provide: getModelToken("RefreshToken"),
          useValue: mockRefreshTokenModel,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    auditService = module.get(AuditService);
    emailService = module.get(EmailService);
    refreshTokenModel = module.get(getModelToken("RefreshToken"));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("register", () => {
    it("should create new user with hashed password", async () => {
      const registerDto: RegisterDto = {
        email: "newuser@example.com",
        password: "Password123!",
        firstName: "Jane",
        lastName: "Smith",
        role: UserRole.USER,
      };

      const createdUser = {
        _id: new Types.ObjectId(),
        email: registerDto.email,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
      };

      usersService.create.mockResolvedValue(createdUser as any);

      const result = await service.register(registerDto);

      expect(result).toEqual(createdUser);
      expect(usersService.create).toHaveBeenCalledWith(registerDto);
      expect(usersService.create).toHaveBeenCalledTimes(1);
      expect(auditService.logUserRegistration).toHaveBeenCalled();
    });

    it("should throw ConflictException for duplicate email", async () => {
      const registerDto: RegisterDto = {
        email: "existing@example.com",
        password: "Password123!",
      };

      const conflictError = new Error("Email already in use");
      (conflictError as any).status = 409;
      usersService.create.mockRejectedValue(conflictError);

      await expect(service.register(registerDto)).rejects.toThrow();
      expect(usersService.create).toHaveBeenCalledWith(registerDto);
    });

    it("should assign correct role", async () => {
      const adminDto: RegisterDto = {
        email: "admin@example.com",
        password: "Admin123!",
        role: UserRole.ADMIN,
      };

      const createdAdmin = {
        _id: new Types.ObjectId(),
        email: adminDto.email,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      };

      usersService.create.mockResolvedValue(createdAdmin as any);

      const result = await service.register(adminDto);

      expect(result.role).toBe(UserRole.ADMIN);
      expect(usersService.create).toHaveBeenCalledWith(adminDto);
    });
  });

  describe("login", () => {
    it("should return token for valid credentials", async () => {
      const loginDto: LoginDto = {
        email: "test@example.com",
        password: "Password123!",
      };

      const hashedPassword = await bcrypt.hash(loginDto.password, 10);
      const userWithPassword = { ...mockUser, passwordHash: hashedPassword };

      usersService.findByEmail.mockResolvedValue(userWithPassword as any);
      jwtService.sign.mockReturnValue("mock-jwt-token");
      usersService.setLastLogin.mockResolvedValue(undefined);
      refreshTokenModel.create.mockResolvedValue({
        token: "mock-refresh-token",
      });

      const result = await service.login(loginDto);

      expect(result).toHaveProperty("accessToken", "mock-jwt-token");
      expect(result).toHaveProperty("refreshToken");
      expect(result).toHaveProperty("expiresIn");
      expect(result.user).toEqual({
        _id: mockUser._id,
        email: mockUser.email,
        role: mockUser.role,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
      });
      expect(usersService.findByEmail).toHaveBeenCalledWith(
        loginDto.email,
        true,
      );
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser._id.toString(),
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(usersService.setLastLogin).toHaveBeenCalledWith(
        mockUser._id.toString(),
      );
      expect(auditService.logSuccessfulLogin).toHaveBeenCalled();
    });

    it("should throw UnauthorizedException for invalid email", async () => {
      const loginDto: LoginDto = {
        email: "nonexistent@example.com",
        password: "Password123!",
      };

      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        "Invalid credentials",
      );
      expect(usersService.findByEmail).toHaveBeenCalledWith(
        loginDto.email,
        true,
      );
      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(auditService.logFailedLogin).toHaveBeenCalled();
    });

    it("should throw UnauthorizedException for invalid password", async () => {
      const loginDto: LoginDto = {
        email: "test@example.com",
        password: "WrongPassword123!",
      };

      const hashedPassword = await bcrypt.hash("CorrectPassword123!", 10);
      const userWithPassword = { ...mockUser, passwordHash: hashedPassword };

      usersService.findByEmail.mockResolvedValue(userWithPassword as any);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        "Invalid credentials",
      );
      expect(usersService.findByEmail).toHaveBeenCalledWith(
        loginDto.email,
        true,
      );
      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(auditService.logFailedLogin).toHaveBeenCalled();
    });

    it("should update lastLogin timestamp", async () => {
      const loginDto: LoginDto = {
        email: "test@example.com",
        password: "Password123!",
      };

      const hashedPassword = await bcrypt.hash(loginDto.password, 10);
      const userWithPassword = { ...mockUser, passwordHash: hashedPassword };

      usersService.findByEmail.mockResolvedValue(userWithPassword as any);
      jwtService.sign.mockReturnValue("mock-jwt-token");
      usersService.setLastLogin.mockResolvedValue(undefined);

      await service.login(loginDto);

      expect(usersService.setLastLogin).toHaveBeenCalledWith(
        mockUser._id.toString(),
      );
      expect(usersService.setLastLogin).toHaveBeenCalledTimes(1);
    });

    it("should log failed login attempts", async () => {
      const loginDto: LoginDto = {
        email: "test@example.com",
        password: "WrongPassword",
      };

      usersService.findByEmail.mockResolvedValue(null);

      const loggerSpy = jest.spyOn(service["logger"], "warn");

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed login attempt for email:"),
      );
    });
  });

  describe("Account Lockout", () => {
    it("should increment failed login attempts on wrong password", async () => {
      const loginDto: LoginDto = {
        email: "test@example.com",
        password: "WrongPassword",
      };

      const hashedPassword = await bcrypt.hash("CorrectPassword", 10);
      const userWithPassword = {
        ...mockUser,
        passwordHash: hashedPassword,
        failedLoginAttempts: 2,
      };

      usersService.findByEmail.mockResolvedValue(userWithPassword as any);
      usersService.findById.mockResolvedValue(userWithPassword as any);
      usersService.updateLoginAttempts.mockResolvedValue(undefined);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(usersService.updateLoginAttempts).toHaveBeenCalledWith(
        mockUser._id.toString(),
        3,
      );
    });

    it("should lock account after 5 failed attempts", async () => {
      const loginDto: LoginDto = {
        email: "test@example.com",
        password: "WrongPassword",
      };

      const hashedPassword = await bcrypt.hash("CorrectPassword", 10);
      const userWithPassword = {
        ...mockUser,
        passwordHash: hashedPassword,
        failedLoginAttempts: 4, // 4th attempt, 5th will lock
      };

      usersService.findByEmail.mockResolvedValue(userWithPassword as any);
      usersService.findById.mockResolvedValue(userWithPassword as any);
      usersService.updateLoginAttempts.mockResolvedValue(undefined);
      auditService.logEvent.mockResolvedValue(undefined);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );

      // Verify account was locked with lockedUntil date
      expect(usersService.updateLoginAttempts).toHaveBeenCalledWith(
        mockUser._id.toString(),
        5,
        expect.any(Date),
      );

      // Verify audit log
      expect(auditService.logEvent).toHaveBeenCalledWith({
        action: "ACCOUNT_LOCKED",
        userId: mockUser._id.toString(),
        metadata: {
          attempts: 5,
          lockedUntil: expect.any(Date),
        },
      });
    });

    it("should reject login for locked account even with correct password", async () => {
      const loginDto: LoginDto = {
        email: "test@example.com",
        password: "CorrectPassword",
      };

      const hashedPassword = await bcrypt.hash("CorrectPassword", 10);
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // Locked for 10 more minutes
      const lockedUser = {
        ...mockUser,
        passwordHash: hashedPassword,
        failedLoginAttempts: 5,
        lockedUntil,
      };

      usersService.findByEmail.mockResolvedValue(lockedUser as any);
      auditService.logEvent.mockResolvedValue(undefined);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );

      // Verify the error message
      try {
        await service.login(loginDto);
      } catch (error: any) {
        expect(error.message).toContain("Account is temporarily locked");
        expect(error.message).toContain("minutes");
      }

      // Verify audit log for locked account attempt
      expect(auditService.logEvent).toHaveBeenCalledWith({
        action: "LOGIN_ATTEMPT_WHILE_LOCKED",
        userId: mockUser._id.toString(),
        metadata: expect.any(Object),
      });
    });

    it("should allow login after lockout period expires", async () => {
      const loginDto: LoginDto = {
        email: "test@example.com",
        password: "CorrectPassword",
      };

      const hashedPassword = await bcrypt.hash("CorrectPassword", 10);
      const expiredLockout = new Date(Date.now() - 1000); // Lockout expired 1 second ago
      const userWithExpiredLock = {
        ...mockUser,
        passwordHash: hashedPassword,
        failedLoginAttempts: 5,
        lockedUntil: expiredLockout,
      };

      usersService.findByEmail.mockResolvedValue(userWithExpiredLock as any);
      usersService.updateLoginAttempts.mockResolvedValue(undefined);
      usersService.setLastLogin.mockResolvedValue(undefined);
      jwtService.sign.mockReturnValue("mock-jwt-token");
      refreshTokenModel.create.mockResolvedValue({
        token: "mock-refresh-token",
      });

      const result = await service.login(loginDto);

      expect(result).toHaveProperty("accessToken");

      // Verify failed attempts were reset
      expect(usersService.updateLoginAttempts).toHaveBeenCalledWith(
        mockUser._id.toString(),
        0,
        null,
      );
    });

    it("should reset failed attempts on successful login", async () => {
      const loginDto: LoginDto = {
        email: "test@example.com",
        password: "CorrectPassword",
      };

      const hashedPassword = await bcrypt.hash("CorrectPassword", 10);
      const userWithFailedAttempts = {
        ...mockUser,
        passwordHash: hashedPassword,
        failedLoginAttempts: 3,
      };

      usersService.findByEmail.mockResolvedValue(userWithFailedAttempts as any);
      usersService.updateLoginAttempts.mockResolvedValue(undefined);
      usersService.setLastLogin.mockResolvedValue(undefined);
      jwtService.sign.mockReturnValue("mock-jwt-token");
      refreshTokenModel.create.mockResolvedValue({
        token: "mock-refresh-token",
      });

      await service.login(loginDto);

      // Verify failed attempts were reset to 0
      expect(usersService.updateLoginAttempts).toHaveBeenCalledWith(
        mockUser._id.toString(),
        0,
        null,
      );
    });

    it("should reject login for suspended account", async () => {
      const loginDto: LoginDto = {
        email: "test@example.com",
        password: "CorrectPassword",
      };

      const hashedPassword = await bcrypt.hash("CorrectPassword", 10);
      const suspendedUser = {
        ...mockUser,
        passwordHash: hashedPassword,
        status: UserStatus.SUSPENDED,
      };

      usersService.findByEmail.mockResolvedValue(suspendedUser as any);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        "Account is not active",
      );
    });
  });

  describe("changePassword", () => {
    it("should update password successfully with correct current password", async () => {
      const userId = mockUserId.toString();
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword123!",
      };

      const hashedOldPassword = await bcrypt.hash(
        changePasswordDto.currentPassword,
        10,
      );
      const userWithPassword = { ...mockUser, passwordHash: hashedOldPassword };

      usersService.findById.mockResolvedValue(userWithPassword as any);
      usersService.updatePassword.mockResolvedValue(undefined);

      const result = await service.changePassword(userId, changePasswordDto);

      expect(result).toEqual({ message: "Password changed successfully" });
      expect(usersService.findById).toHaveBeenCalledWith(userId, true);
      expect(usersService.updatePassword).toHaveBeenCalledWith(
        userId,
        changePasswordDto.newPassword,
      );
      expect(auditService.logPasswordChange).toHaveBeenCalled();
    });

    it("should throw UnauthorizedException for incorrect current password", async () => {
      const userId = mockUserId.toString();
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: "WrongOldPassword",
        newPassword: "NewPassword123!",
      };

      const hashedOldPassword = await bcrypt.hash("CorrectOldPassword123!", 10);
      const userWithPassword = { ...mockUser, passwordHash: hashedOldPassword };

      usersService.findById.mockResolvedValue(userWithPassword as any);

      await expect(
        service.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.changePassword(userId, changePasswordDto),
      ).rejects.toThrow("Current password is incorrect");
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });

    it("should hash new password properly", async () => {
      const userId = mockUserId.toString();
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword123!",
      };

      const hashedOldPassword = await bcrypt.hash(
        changePasswordDto.currentPassword,
        10,
      );
      const userWithPassword = { ...mockUser, passwordHash: hashedOldPassword };

      usersService.findById.mockResolvedValue(userWithPassword as any);
      usersService.updatePassword.mockResolvedValue(undefined);

      await service.changePassword(userId, changePasswordDto);

      expect(usersService.updatePassword).toHaveBeenCalledWith(
        userId,
        changePasswordDto.newPassword,
      );
      // The UsersService is responsible for hashing, so we just verify it's called with the plain password
    });
  });

  describe("Refresh Token Operations", () => {
    describe("generateRefreshToken", () => {
      it("should generate a refresh token and store it in database", async () => {
        const userId = mockUserId.toString();
        const ipAddress = "127.0.0.1";
        const userAgent = "Mozilla/5.0";

        refreshTokenModel.create.mockResolvedValue({
          token: "generated-token",
          userId,
          expiresAt: new Date(),
          ipAddress,
          userAgent,
        });

        const token = await service.generateRefreshToken(
          userId,
          ipAddress,
          userAgent,
        );

        expect(token).toBeDefined();
        expect(typeof token).toBe("string");
        expect(token.length).toBe(128); // 64 bytes in hex = 128 characters
        expect(refreshTokenModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            userId,
            token: expect.any(String),
            expiresAt: expect.any(Date),
            ipAddress,
            userAgent,
          }),
        );
      });

      it("should include IP address and user agent if provided", async () => {
        const userId = mockUserId.toString();
        const ipAddress = "192.168.1.1";
        const userAgent = "Chrome/120.0";

        refreshTokenModel.create.mockResolvedValue({
          token: "token",
          userId,
          expiresAt: new Date(),
          ipAddress,
          userAgent,
        });

        await service.generateRefreshToken(userId, ipAddress, userAgent);

        expect(refreshTokenModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            ipAddress,
            userAgent,
          }),
        );
      });

      it("should handle database errors gracefully", async () => {
        const userId = mockUserId.toString();
        refreshTokenModel.create.mockRejectedValue(new Error("Database error"));

        await expect(service.generateRefreshToken(userId)).rejects.toThrow(
          "Failed to generate refresh token",
        );
      });

      it("should set expiry to 30 days from now by default", async () => {
        const userId = mockUserId.toString();
        const beforeCall = new Date();
        beforeCall.setDate(beforeCall.getDate() + 30);

        refreshTokenModel.create.mockImplementation((data: any) => {
          const expiryDate = new Date(data.expiresAt);
          const expectedDate = new Date();
          expectedDate.setDate(expectedDate.getDate() + 30);

          // Allow 1 minute tolerance for test execution time
          const timeDiff = Math.abs(
            expiryDate.getTime() - expectedDate.getTime(),
          );
          expect(timeDiff).toBeLessThan(60000); // Less than 1 minute difference

          return Promise.resolve({ ...data });
        });

        await service.generateRefreshToken(userId);

        expect(refreshTokenModel.create).toHaveBeenCalled();
      });
    });

    describe("refreshAccessToken", () => {
      it("should return new access token and refresh token (rotation)", async () => {
        const oldRefreshToken = "valid-refresh-token";
        const tokenDoc = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          token: oldRefreshToken,
          expiresAt: new Date(Date.now() + 86400000), // 1 day from now
          ipAddress: "127.0.0.1",
          userAgent: "Mozilla/5.0",
        };

        refreshTokenModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue(tokenDoc),
        });

        refreshTokenModel.findByIdAndDelete.mockReturnValue({
          exec: jest.fn().mockResolvedValue(tokenDoc),
        });

        refreshTokenModel.create.mockResolvedValue({
          token: "new-refresh-token",
        });

        usersService.findById.mockResolvedValue(mockUser as any);
        jwtService.sign.mockReturnValue("new-access-token");
        auditService.logEvent.mockResolvedValue(undefined);

        const result = await service.refreshAccessToken(oldRefreshToken);

        expect(result).toEqual({
          accessToken: "new-access-token",
          refreshToken: expect.any(String),
          expiresIn: expect.any(Number),
          user: expect.objectContaining({
            id: mockUser._id.toString(),
            email: mockUser.email,
            role: mockUser.role,
          }),
        });

        // Verify old token was deleted
        expect(refreshTokenModel.findByIdAndDelete).toHaveBeenCalledWith(
          tokenDoc._id,
        );

        // Verify new token was created
        expect(refreshTokenModel.create).toHaveBeenCalled();

        // Verify JWT was signed
        expect(jwtService.sign).toHaveBeenCalledWith({
          sub: mockUser._id.toString(),
          email: mockUser.email,
          role: mockUser.role,
        });

        // Verify audit log
        expect(auditService.logEvent).toHaveBeenCalledWith({
          action: "TOKEN_REFRESHED",
          userId: mockUser._id.toString(),
          ipAddress: undefined,
          userAgent: undefined,
          metadata: { email: mockUser.email },
        });
      });

      it("should throw UnauthorizedException for invalid refresh token", async () => {
        const invalidToken = "invalid-token";

        refreshTokenModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        });

        await expect(service.refreshAccessToken(invalidToken)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(service.refreshAccessToken(invalidToken)).rejects.toThrow(
          "Invalid refresh token",
        );
      });

      it("should throw UnauthorizedException for expired refresh token", async () => {
        const expiredToken = "expired-token";
        const expiredTokenDoc = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          token: expiredToken,
          expiresAt: new Date(Date.now() - 86400000), // 1 day ago
        };

        refreshTokenModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue(expiredTokenDoc),
        });

        refreshTokenModel.findByIdAndDelete.mockReturnValue({
          exec: jest.fn().mockResolvedValue(expiredTokenDoc),
        });

        await expect(service.refreshAccessToken(expiredToken)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(service.refreshAccessToken(expiredToken)).rejects.toThrow(
          "Refresh token expired",
        );

        // Verify expired token was cleaned up
        expect(refreshTokenModel.findByIdAndDelete).toHaveBeenCalledWith(
          expiredTokenDoc._id,
        );
      });

      it("should throw UnauthorizedException if user no longer exists", async () => {
        const refreshToken = "valid-token";
        const tokenDoc = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 86400000),
        };

        refreshTokenModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue(tokenDoc),
        });

        usersService.findById.mockRejectedValue(new Error("User not found"));

        await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it("should reject refresh for suspended user account", async () => {
        const refreshToken = "valid-token";
        const tokenDoc = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 86400000),
        };

        const suspendedUser = { ...mockUser, status: UserStatus.SUSPENDED };

        refreshTokenModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue(tokenDoc),
        });

        usersService.findById.mockResolvedValue(suspendedUser as any);

        await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(
          "User account is not active",
        );
      });

      it("should invalidate old refresh token after rotation", async () => {
        const oldToken = "old-refresh-token";
        const tokenDoc = {
          _id: new Types.ObjectId(),
          userId: mockUserId,
          token: oldToken,
          expiresAt: new Date(Date.now() + 86400000),
        };

        // First refresh - should succeed
        refreshTokenModel.findOne.mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(tokenDoc),
        });

        refreshTokenModel.findByIdAndDelete.mockReturnValue({
          exec: jest.fn().mockResolvedValue(tokenDoc),
        });

        refreshTokenModel.create.mockResolvedValue({ token: "new-token" });
        usersService.findById.mockResolvedValue(mockUser as any);
        jwtService.sign.mockReturnValue("new-access-token");
        auditService.logEvent.mockResolvedValue(undefined);

        await service.refreshAccessToken(oldToken);

        // Try to use old token again - should fail
        refreshTokenModel.findOne.mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(null),
        });

        await expect(service.refreshAccessToken(oldToken)).rejects.toThrow(
          UnauthorizedException,
        );
      });
    });

    describe("revokeRefreshToken", () => {
      it("should delete refresh token from database", async () => {
        const refreshToken = "token-to-revoke";

        refreshTokenModel.deleteOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
        });

        const result = await service.revokeRefreshToken(refreshToken);

        expect(result).toEqual({ message: "Logged out successfully" });
        expect(refreshTokenModel.deleteOne).toHaveBeenCalledWith({
          token: refreshToken,
        });
      });

      it("should throw error for non-existent token", async () => {
        const nonExistentToken = "non-existent";

        refreshTokenModel.deleteOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
        });

        await expect(
          service.revokeRefreshToken(nonExistentToken),
        ).rejects.toThrow("Invalid refresh token");
      });
    });

    describe("revokeAllRefreshTokens", () => {
      it("should delete all refresh tokens for a user", async () => {
        const userId = mockUserId.toString();

        refreshTokenModel.deleteMany.mockReturnValue({
          exec: jest.fn().mockResolvedValue({ deletedCount: 3 }),
        });

        const result = await service.revokeAllRefreshTokens(userId);

        expect(result).toEqual({ message: "Revoked 3 sessions successfully" });
        expect(refreshTokenModel.deleteMany).toHaveBeenCalledWith({ userId });
      });

      it("should return zero count if user has no tokens", async () => {
        const userId = mockUserId.toString();

        refreshTokenModel.deleteMany.mockReturnValue({
          exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
        });

        const result = await service.revokeAllRefreshTokens(userId);

        expect(result).toEqual({ message: "Revoked 0 sessions successfully" });
        expect(refreshTokenModel.deleteMany).toHaveBeenCalledWith({ userId });
      });

      it("should handle database errors", async () => {
        const userId = mockUserId.toString();

        refreshTokenModel.deleteMany.mockReturnValue({
          exec: jest.fn().mockRejectedValue(new Error("Database error")),
        });

        await expect(service.revokeAllRefreshTokens(userId)).rejects.toThrow(
          "Failed to revoke all sessions",
        );
      });
    });
  });
});
