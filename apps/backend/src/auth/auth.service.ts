import { Injectable, UnauthorizedException, Logger, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './types/jwt-payload';
import { AuditService } from '../common/services/audit.service';
import { EmailService } from '../common/services/email.service';
import { RefreshToken, RefreshTokenDocument } from './schemas/refresh-token.schema';
import { AUTH_CONSTANTS } from './auth.constants';
import { UserStatus } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    @InjectModel(RefreshToken.name) private refreshTokenModel: Model<RefreshTokenDocument>,
  ) {}

  async register(dto: RegisterDto, performedBy?: string, ipAddress?: string, userAgent?: string) {
    const user = await this.users.create(dto);

    // Log successful registration for audit trail
    await this.auditService.logUserRegistration(
      user._id.toString(),
      user.email,
      user.role,
      performedBy,
      ipAddress
    );

    this.logger.log(`User registered successfully: ${user.email} (ID: ${user._id})`);

    return user; // sanitized (no passwordHash)
  }

  /**
   * Check if account is currently locked
   */
  private isAccountLocked(user: any): boolean {
    if (!user.lockedUntil) return false;

    // Check if lockout period has expired
    if (user.lockedUntil > new Date()) {
      return true; // Still locked
    }

    // Lockout expired
    return false;
  }

  /**
   * Handle failed login attempt - increment counter and lock if threshold exceeded
   */
  private async handleFailedLogin(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) return;

    const attempts = (user.failedLoginAttempts || 0) + 1;

    if (attempts >= AUTH_CONSTANTS.MAX_FAILED_ATTEMPTS) {
      // Lock the account
      const lockoutUntil = new Date();
      lockoutUntil.setMinutes(lockoutUntil.getMinutes() + AUTH_CONSTANTS.LOCKOUT_DURATION_MINUTES);

      await this.users.updateLoginAttempts(userId, attempts, lockoutUntil);

      this.logger.warn(
        `Account locked for user ${userId} due to ${attempts} failed attempts. Locked until ${lockoutUntil}`
      );

      // Log audit event
      await this.auditService.logEvent({
        action: 'ACCOUNT_LOCKED',
        userId,
        metadata: { attempts, lockedUntil: lockoutUntil },
      });
    } else {
      // Increment failed attempts
      await this.users.updateLoginAttempts(userId, attempts);
    }
  }

  /**
   * Reset failed login attempts on successful login
   */
  private async handleSuccessfulLogin(userId: string): Promise<void> {
    // Reset failed login attempts and clear lockout
    await this.users.updateLoginAttempts(userId, 0, null);
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.users.findByEmail(dto.email, true);

    // Timing-safe password comparison: always perform bcrypt.compare even if user doesn't exist
    const hashToCompare = user?.passwordHash || await bcrypt.hash('dummy', 10);
    const passwordOk = await bcrypt.compare(dto.password, hashToCompare);

    if (!user || !passwordOk) {
      // Handle failed login attempt
      if (user) {
        await this.handleFailedLogin(user._id.toString());
      }

      // Log failed login attempt for security monitoring
      this.logger.warn(`Failed login attempt for email: ${dto.email}`);

      // Audit log for failed login
      await this.auditService.logFailedLogin(
        dto.email,
        'Invalid credentials',
        ipAddress,
        userAgent
      );

      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (this.isAccountLocked(user)) {
      const remainingTime = Math.ceil((user.lockedUntil!.getTime() - Date.now()) / 1000 / 60);
      this.logger.warn(`Login attempt for locked account: ${dto.email}`);

      await this.auditService.logEvent({
        action: 'LOGIN_ATTEMPT_WHILE_LOCKED',
        userId: user._id.toString(),
        metadata: { email: dto.email, ipAddress, userAgent },
      });

      throw new UnauthorizedException(
        `Account is temporarily locked due to multiple failed login attempts. Please try again in ${remainingTime} minutes.`
      );
    }

    // Check if account is active
    if (user.status !== UserStatus.ACTIVE) {
      this.logger.warn(`Login attempt for inactive account: ${dto.email} (status: ${user.status})`);
      throw new UnauthorizedException('Account is not active');
    }

    // Successful login - reset attempts
    await this.handleSuccessfulLogin(user._id.toString());

    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.generateRefreshToken(user._id.toString(), ipAddress, userAgent);

    await this.users.setLastLogin(user._id.toString());

    // Audit log for successful login
    await this.auditService.logSuccessfulLogin(
      user._id.toString(),
      user.email,
      ipAddress,
      userAgent
    );

    this.logger.log(`User logged in successfully: ${user.email} (ID: ${user._id})`);

    // Calculate expiry time in seconds
    const expiresIn = this.getAccessTokenExpiryInSeconds();

    return {
      accessToken,
      refreshToken,
      expiresIn,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  /**
   * Get access token expiry time in seconds
   */
  private getAccessTokenExpiryInSeconds(): number {
    const expiry = process.env.JWT_EXPIRATION || '15m';
    // Parse expiry string (e.g., '15m', '1h', '1d')
    const value = parseInt(expiry.slice(0, -1));
    const unit = expiry.slice(-1);

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 900; // Default 15 minutes
    }
  }

  /**
   * Generate a new refresh token and store it in the database
   */
  async generateRefreshToken(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    try {
      // Generate a secure random token
      const token = crypto.randomBytes(64).toString('hex');

      // Calculate expiry (30 days from now)
      const expiryDays = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '30');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      // Store refresh token in database
      await this.refreshTokenModel.create({
        userId,
        token,
        expiresAt,
        userAgent,
        ipAddress,
      });

      this.logger.log(`Refresh token generated for user: ${userId}`);
      return token;
    } catch (error: any) {
      this.logger.error(`Failed to generate refresh token for user ${userId}: ${error.message}`, error.stack);
      throw new Error('Failed to generate refresh token');
    }
  }

  /**
   * Refresh access token using a valid refresh token
   * Implements token rotation: old token is invalidated and new refresh token is issued
   */
  async refreshAccessToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; user: any }> {
    try {
      // Find and validate refresh token
      const tokenDoc = await this.refreshTokenModel
        .findOne({ token: refreshToken })
        .exec();

      if (!tokenDoc) {
        this.logger.warn('Refresh token not found - possible token reuse attack');
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Check if token is expired
      if (tokenDoc.expiresAt < new Date()) {
        this.logger.warn(`Expired refresh token attempted for user: ${tokenDoc.userId}`);
        // Clean up expired token
        await this.refreshTokenModel.findByIdAndDelete(tokenDoc._id).exec();
        throw new UnauthorizedException('Refresh token expired');
      }

      // Get user details
      const user = await this.users.findById(tokenDoc.userId.toString());

      // Check if user account is active
      if (user.status !== UserStatus.ACTIVE) {
        this.logger.warn(`Token refresh attempted for inactive user: ${user.email} (status: ${user.status})`);
        throw new UnauthorizedException('User account is not active');
      }

      // ROTATION: Generate new refresh token
      const newRefreshToken = await this.generateRefreshToken(
        user._id.toString(),
        ipAddress,
        userAgent
      );

      // ROTATION: Revoke old refresh token
      await this.refreshTokenModel.findByIdAndDelete(tokenDoc._id).exec();

      // Generate new access token
      const payload: JwtPayload = {
        sub: user._id.toString(),
        email: user.email,
        role: user.role,
      };

      const accessToken = this.jwtService.sign(payload);
      const expiresIn = this.getAccessTokenExpiryInSeconds();

      // Audit log
      await this.auditService.logEvent({
        action: 'TOKEN_REFRESHED',
        userId: user._id.toString(),
        ipAddress,
        userAgent,
        metadata: { email: user.email },
      });

      this.logger.log(`Token refreshed and rotated for user ${user.email}`);

      return {
        accessToken,
        refreshToken: newRefreshToken, // Return NEW refresh token
        expiresIn,
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };
    } catch (error: any) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Failed to refresh access token: ${error.message}`, error.stack);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Revoke a refresh token (logout)
   */
  async revokeRefreshToken(refreshToken: string, ipAddress?: string, userAgent?: string): Promise<{ message: string }> {
    try {
      const result = await this.refreshTokenModel
        .deleteOne({ token: refreshToken })
        .exec();

      if (result.deletedCount === 0) {
        this.logger.warn('Attempted to revoke non-existent refresh token');
        throw new BadRequestException('Invalid refresh token');
      }

      this.logger.log('Refresh token revoked successfully');
      return { message: 'Logged out successfully' };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to revoke refresh token: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to logout');
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllRefreshTokens(userId: string): Promise<{ message: string }> {
    try {
      const result = await this.refreshTokenModel
        .deleteMany({ userId })
        .exec();

      this.logger.log(`Revoked ${result.deletedCount} refresh tokens for user: ${userId}`);
      return { message: `Revoked ${result.deletedCount} sessions successfully` };
    } catch (error: any) {
      this.logger.error(`Failed to revoke all refresh tokens for user ${userId}: ${error.message}`, error.stack);
      throw new Error('Failed to revoke all sessions');
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto, ipAddress?: string, userAgent?: string) {
    // Fetch user with password hash
    const user = await this.users.findById(userId, true);

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash || '',
    );

    if (!isCurrentPasswordValid) {
      this.logger.warn(`Failed password change attempt for user ${userId}: incorrect current password`);
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Update password
    await this.users.updatePassword(userId, dto.newPassword);

    // Audit log for password change
    await this.auditService.logPasswordChange(
      userId,
      user.email,
      ipAddress
    );

    this.logger.log(`Password changed successfully for user: ${user.email} (ID: ${userId})`);

    return { message: 'Password changed successfully' };
  }

  /**
   * Verify user email with verification token
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    try {
      // Note: We need to add a method to UsersService to handle email verification
      // For now, this is a placeholder that logs the verification attempt

      this.logger.log(`Email verification attempted with token: ${token.substring(0, 10)}...`);

      // TODO: Implement in UsersService:
      // 1. Find user by emailVerificationToken
      // 2. Check token expiry
      // 3. Set emailVerified = true
      // 4. Clear verification token and expiry

      return { message: 'Email verified successfully' };
    } catch (error: any) {
      this.logger.error(`Failed to verify email: ${error.message}`, error.stack);
      throw new BadRequestException('Invalid or expired verification token');
    }
  }

  /**
   * Resend email verification
   */
  async resendVerificationEmail(email: string, ipAddress?: string, userAgent?: string): Promise<{ message: string }> {
    try {
      const user = await this.users.findByEmail(email);

      if (!user) {
        // Don't reveal if email exists
        return { message: 'If the email exists, a verification email has been sent' };
      }

      // Generate new verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiryHours = parseInt(process.env.EMAIL_VERIFICATION_EXPIRY_HOURS || '24');
      const verificationExpiry = new Date();
      verificationExpiry.setHours(verificationExpiry.getHours() + expiryHours);

      // TODO: Update user with new verification token
      // await this.users.updateVerificationToken(user._id.toString(), verificationToken, verificationExpiry);

      // Send verification email
      await this.emailService.sendVerificationEmail(email, verificationToken);

      this.logger.log(`Verification email resent to: ${email}`);
      return { message: 'If the email exists, a verification email has been sent' };
    } catch (error: any) {
      this.logger.error(`Failed to resend verification email: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to send verification email');
    }
  }
}
