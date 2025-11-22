import { Body, Controller, Post, UseGuards, Ip, Headers } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { VerifyEmailDto, ResendVerificationDto } from "./dto/verify-email.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./roles/roles.guard";
import { Roles } from "./roles/roles.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import { JwtPayload } from "./types/jwt-payload";
import { UserRole } from "../users/schemas/user.schema";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Register a new user (Admin only)" })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: "User registered successfully" })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing JWT token",
  })
  @ApiResponse({ status: 403, description: "Forbidden - Admin role required" })
  @ApiResponse({ status: 409, description: "Conflict - Email already in use" })
  register(
    @Body() dto: RegisterDto,
    @CurrentUser() admin: JwtPayload,
    @Ip() ipAddress?: string,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.auth.register(dto, admin.sub, ipAddress, userAgent);
  }

  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @ApiOperation({ summary: "User login" })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: "Login successful - Returns JWT token and user data",
  })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid credentials",
  })
  @ApiResponse({
    status: 429,
    description:
      "Too many requests - Rate limit exceeded (5 attempts per minute)",
  })
  login(
    @Body() dto: LoginDto,
    @Ip() ipAddress?: string,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.auth.login(dto, ipAddress, userAgent);
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 attempts per minute
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Change user password" })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: "Password changed successfully" })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @ApiResponse({
    status: 401,
    description:
      "Unauthorized - Invalid JWT token or incorrect current password",
  })
  @ApiResponse({
    status: 429,
    description:
      "Too many requests - Rate limit exceeded (3 attempts per minute)",
  })
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
    @Ip() ipAddress?: string,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.auth.changePassword(user.sub, dto, ipAddress, userAgent);
  }

  @Post("refresh")
  @ApiOperation({ summary: "Refresh access token using refresh token" })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: "Returns new access token" })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @ApiResponse({ status: 401, description: "Invalid or expired refresh token" })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Ip() ipAddress?: string,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.auth.refreshAccessToken(dto.refreshToken, ipAddress, userAgent);
  }

  @Post("logout")
  @ApiOperation({ summary: "Logout and revoke refresh token" })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: "Logged out successfully" })
  @ApiResponse({ status: 400, description: "Invalid refresh token" })
  logout(
    @Body() dto: RefreshTokenDto,
    @Ip() ipAddress?: string,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.auth.revokeRefreshToken(dto.refreshToken, ipAddress, userAgent);
  }

  @Post("verify-email")
  @ApiOperation({ summary: "Verify email address with token" })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({ status: 200, description: "Email verified successfully" })
  @ApiResponse({
    status: 400,
    description: "Invalid or expired verification token",
  })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Post("resend-verification")
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 attempts per minute
  @ApiOperation({ summary: "Resend email verification" })
  @ApiBody({ type: ResendVerificationDto })
  @ApiResponse({
    status: 200,
    description: "Verification email sent if address exists",
  })
  @ApiResponse({
    status: 429,
    description:
      "Too many requests - Rate limit exceeded (3 attempts per minute)",
  })
  resendVerification(
    @Body() dto: ResendVerificationDto,
    @Ip() ipAddress?: string,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.auth.resendVerificationEmail(dto.email, ipAddress, userAgent);
  }
}
