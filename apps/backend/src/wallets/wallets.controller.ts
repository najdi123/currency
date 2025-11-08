import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { WalletsService } from './wallets.service';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { UserIdParamDto } from './dto/user-id-param.dto';
import { GetTransactionsQueryDto } from './dto/get-transactions-query.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload';

@ApiTags('wallets')
@Controller('wallets')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  /**
   * Helper method to check if user can access a specific wallet
   */
  private checkWalletAccess(currentUser: JwtPayload, targetUserId: string): void {
    // Admins can access any wallet
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    // Regular users can only access their own wallet
    if (currentUser.sub !== targetUserId) {
      throw new ForbiddenException('You can only access your own wallet');
    }
  }

  // GET /api/wallets - List all wallets (Admin only)
  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all wallets with pagination (Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of wallets' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  listAllWallets(@Query() query: PaginationDto) {
    return this.wallets.listAllWallets({
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  // GET /api/wallets/me - Get current user's wallet
  @Get('me')
  @ApiOperation({ summary: 'Get your own wallet' })
  @ApiResponse({ status: 200, description: 'Returns user wallet' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  getMyWallet(@CurrentUser() user: JwtPayload) {
    return this.wallets.getUserWallet(user.sub);
  }

  // GET /api/wallets/me/transactions - Get current user's transaction history
  @Get('me/transactions')
  @ApiOperation({ summary: 'Get your own transaction history' })
  @ApiResponse({ status: 200, description: 'Returns paginated transaction history' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  getMyTransactions(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetTransactionsQueryDto,
  ) {
    return this.wallets.getTransactionHistory(user.sub, {
      page: query.page,
      pageSize: query.pageSize,
      currencyCode: query.currencyCode,
      direction: query.direction,
    });
  }

  // GET /api/wallets/:userId - Get user's wallet (Admin or self)
  @Get(':userId')
  @ApiOperation({ summary: 'Get wallet by user ID (Admin or self)' })
  @ApiParam({ name: 'userId', description: 'User ID', example: '507f1f77bcf86cd799439011' })
  @ApiResponse({ status: 200, description: 'Returns user wallet' })
  @ApiResponse({ status: 400, description: 'Invalid user ID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Can only access your own wallet' })
  getWallet(@Param() params: UserIdParamDto, @CurrentUser() user: JwtPayload) {
    this.checkWalletAccess(user, params.userId);
    return this.wallets.getUserWallet(params.userId);
  }

  // GET /api/wallets/:userId/transactions - Get user's transaction history (Admin or self)
  @Get(':userId/transactions')
  @ApiOperation({ summary: 'Get transaction history by user ID (Admin or self)' })
  @ApiParam({ name: 'userId', description: 'User ID', example: '507f1f77bcf86cd799439011' })
  @ApiQuery({ type: GetTransactionsQueryDto })
  @ApiResponse({ status: 200, description: 'Returns paginated transaction history' })
  @ApiResponse({ status: 400, description: 'Invalid user ID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only access your own transaction history',
  })
  getTransactions(
    @Param() params: UserIdParamDto,
    @Query() query: GetTransactionsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    this.checkWalletAccess(user, params.userId);
    return this.wallets.getTransactionHistory(params.userId, {
      page: query.page,
      pageSize: query.pageSize,
      currencyCode: query.currencyCode,
      direction: query.direction,
    });
  }

  // POST /api/wallets/:userId/balance - Adjust balance (Admin only)
  @Post(':userId/balance')
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @ApiOperation({ summary: 'Adjust wallet balance (Admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID', example: '507f1f77bcf86cd799439011' })
  @ApiBody({ type: AdjustBalanceDto })
  @ApiResponse({ status: 201, description: 'Balance adjusted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data or user ID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required or insufficient balance' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async adjustBalance(
    @Param() params: UserIdParamDto,
    @Body() dto: AdjustBalanceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.wallets.adjustBalance({
      userId: params.userId,
      currencyType: dto.currencyType,
      currencyCode: dto.currencyCode,
      direction: dto.direction,
      amount: dto.amount,
      reason: dto.reason,
      processedBy: user.sub,
      requestId: dto.requestId,
      idempotencyKey: dto.idempotencyKey,
      meta: {
        adminId: user.sub,
        adminEmail: user.email,
      },
    });
  }
}
