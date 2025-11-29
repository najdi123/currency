import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { AdminService } from './admin.service';
import {
  CreateManagedItemDto,
  UpdateManagedItemDto,
  OverridePriceDto,
  ManagedItemResponseDto,
  ManagedItemListResponseDto,
  DiagnosticDataResponseDto,
  ListManagedItemsQueryDto,
} from './dto';

/**
 * AdminController
 *
 * Protected endpoints for managing market items.
 * All endpoints require JWT authentication and ADMIN role.
 *
 * Endpoints:
 * - GET  /api/admin/items              - List all items with current prices
 * - GET  /api/admin/items/group/:code  - Get all variants of a currency
 * - GET  /api/admin/items/:code        - Get single item details
 * - POST /api/admin/items              - Create manual currency
 * - PATCH /api/admin/items/:code       - Update item settings
 * - DELETE /api/admin/items/:code      - Delete item
 * - POST /api/admin/items/:code/override    - Override API price
 * - DELETE /api/admin/items/:code/override  - Remove override
 * - GET  /api/admin/data/diagnose/:code     - Diagnostic view
 */
@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ==================== LIST & GET ====================

  @Get('items')
  @ApiOperation({
    summary: 'List all managed items',
    description:
      'Returns paginated list of all managed items with current prices from ohlc_permanent. Supports filtering by category, source, active status, and override status.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of managed items',
    type: ManagedItemListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async listItems(
    @Query() query: ListManagedItemsQueryDto,
  ): Promise<ManagedItemListResponseDto> {
    return this.adminService.listItems(query);
  }

  @Get('items/group/:parentCode')
  @ApiOperation({
    summary: 'Get items by group',
    description:
      'Returns all items that share the same parentCode (e.g., all USD variants: usd_sell, usd_buy)',
  })
  @ApiParam({
    name: 'parentCode',
    description: 'Parent code for grouping (e.g., "usd" for USD variants)',
    example: 'usd',
  })
  @ApiResponse({
    status: 200,
    description: 'List of items in the group',
    type: [ManagedItemResponseDto],
  })
  @ApiResponse({ status: 404, description: 'No items found with this parent code' })
  async getItemsByGroup(
    @Param('parentCode') parentCode: string,
  ): Promise<ManagedItemResponseDto[]> {
    return this.adminService.getItemsByGroup(parentCode);
  }

  @Get('items/:code')
  @ApiOperation({
    summary: 'Get single item',
    description:
      'Returns detailed information about a single managed item including current price',
  })
  @ApiParam({
    name: 'code',
    description: 'Item code (lowercase)',
    example: 'usd_sell',
  })
  @ApiResponse({
    status: 200,
    description: 'Item details',
    type: ManagedItemResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async getItem(@Param('code') code: string): Promise<ManagedItemResponseDto> {
    return this.adminService.getItem(code);
  }

  // ==================== CREATE, UPDATE, DELETE ====================

  @Post('items')
  @ApiOperation({
    summary: 'Create new managed item',
    description:
      'Creates a new managed item. Can be used for manual currencies or to pre-configure items before API data arrives.',
  })
  @ApiResponse({
    status: 201,
    description: 'Item created successfully',
    type: ManagedItemResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Item with this code already exists' })
  async createItem(
    @Body() dto: CreateManagedItemDto,
    @Request() req: { user: { sub: string } },
  ): Promise<ManagedItemResponseDto> {
    return this.adminService.createItem(dto, req.user.sub);
  }

  @Patch('items/:code')
  @ApiOperation({
    summary: 'Update managed item',
    description:
      'Updates display settings, category, or other properties of a managed item. Does not affect price data.',
  })
  @ApiParam({
    name: 'code',
    description: 'Item code to update',
    example: 'usd_sell',
  })
  @ApiResponse({
    status: 200,
    description: 'Item updated successfully',
    type: ManagedItemResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async updateItem(
    @Param('code') code: string,
    @Body() dto: UpdateManagedItemDto,
  ): Promise<ManagedItemResponseDto> {
    return this.adminService.updateItem(code, dto);
  }

  @Delete('items/:code')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete managed item',
    description:
      'Removes a managed item from the system. Does not delete price history from ohlc_permanent.',
  })
  @ApiParam({
    name: 'code',
    description: 'Item code to delete',
    example: 'custom_item',
  })
  @ApiResponse({ status: 204, description: 'Item deleted successfully' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async deleteItem(@Param('code') code: string): Promise<void> {
    return this.adminService.deleteItem(code);
  }

  // ==================== PRICE OVERRIDE ====================

  @Post('items/:code/override')
  @ApiOperation({
    summary: 'Set price override',
    description:
      'Sets an admin override for the item price. When overridden, this price will be shown instead of the API price. Useful for correcting data errors or displaying manual prices.',
  })
  @ApiParam({
    name: 'code',
    description: 'Item code to override',
    example: 'usd_sell',
  })
  @ApiResponse({
    status: 200,
    description: 'Override set successfully',
    type: ManagedItemResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async setOverride(
    @Param('code') code: string,
    @Body() dto: OverridePriceDto,
    @Request() req: { user: { sub: string } },
  ): Promise<ManagedItemResponseDto> {
    return this.adminService.setOverride(code, dto, req.user.sub);
  }

  @Delete('items/:code/override')
  @ApiOperation({
    summary: 'Remove price override',
    description:
      'Removes the admin override from an item. The item will return to showing the API price from ohlc_permanent.',
  })
  @ApiParam({
    name: 'code',
    description: 'Item code to remove override from',
    example: 'usd_sell',
  })
  @ApiResponse({
    status: 200,
    description: 'Override removed successfully',
    type: ManagedItemResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async removeOverride(
    @Param('code') code: string,
  ): Promise<ManagedItemResponseDto> {
    return this.adminService.removeOverride(code);
  }

  // ==================== DIAGNOSTIC ====================

  @Get('data/diagnose/:itemCode')
  @ApiOperation({
    summary: 'Diagnose item data sources',
    description:
      'Returns diagnostic information showing all data sources for an item: managed_items configuration, ohlc_permanent data, and which source is being used for the effective price. Useful for debugging data issues.',
  })
  @ApiParam({
    name: 'itemCode',
    description: 'Item code to diagnose (can be uppercase or lowercase)',
    example: 'USD_SELL',
  })
  @ApiResponse({
    status: 200,
    description: 'Diagnostic data',
    type: DiagnosticDataResponseDto,
  })
  async diagnoseItem(
    @Param('itemCode') itemCode: string,
  ): Promise<DiagnosticDataResponseDto> {
    return this.adminService.getDiagnosticData(itemCode);
  }

  // ==================== MIGRATION ====================

  @Post('migrate/initialize')
  @ApiOperation({
    summary: 'Initialize managed items from OHLC data',
    description:
      'Populates the managed_items collection from ohlc_permanent. Creates entries for all unique items found in the database. Safe to run multiple times - existing items are skipped.',
  })
  @ApiResponse({
    status: 200,
    description: 'Migration result',
    schema: {
      type: 'object',
      properties: {
        created: { type: 'number', description: 'Number of items created' },
        skipped: { type: 'number', description: 'Number of items skipped (already exist)' },
        items: { type: 'array', items: { type: 'string' }, description: 'List of created item codes' },
      },
    },
  })
  async initializeFromOhlc(): Promise<{ created: number; skipped: number; items: string[] }> {
    return this.adminService.initializeFromOhlc();
  }
}
