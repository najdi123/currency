import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Ip,
  Headers,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtPayload } from "../auth/types/jwt-payload";
import { UpdateOwnProfileDto } from "./dto/update-own-profile.dto";

@ApiTags("profile")
@Controller("profile")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({ status: 200, description: "Returns current user profile" })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing JWT token",
  })
  async getProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.findById(user.sub);
  }

  @Patch("me")
  @ApiOperation({ summary: "Update current user profile" })
  @ApiBody({ type: UpdateOwnProfileDto })
  @ApiResponse({ status: 200, description: "Profile updated successfully" })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing JWT token",
  })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateOwnProfileDto,
    @Ip() ipAddress?: string,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.usersService.update(
      user.sub,
      dto,
      user.sub,
      ipAddress,
      userAgent,
    );
  }
}
