import { Controller, Get, Logger } from '@nestjs/common';
import { NavasanService } from './navasan.service';

@Controller('navasan')
export class NavasanController {
  private readonly logger = new Logger(NavasanController.name);

  constructor(private readonly navasanService: NavasanService) {}

  /**
   * GET /api/navasan/latest
   * Returns all latest prices (currencies, crypto, and gold)
   */
  @Get('latest')
  async getLatest() {
    this.logger.log('GET /api/navasan/latest - Fetching all latest rates');
    return this.navasanService.getLatestRates();
  }

  /**
   * GET /api/navasan/currencies
   * Returns only currency rates (USD, EUR, GBP, CAD, AUD)
   */
  @Get('currencies')
  async getCurrencies() {
    this.logger.log('GET /api/navasan/currencies - Fetching currency rates');
    return this.navasanService.getCurrencies();
  }

  /**
   * GET /api/navasan/crypto
   * Returns only cryptocurrency rates (USDT, BTC, ETH)
   */
  @Get('crypto')
  async getCrypto() {
    this.logger.log('GET /api/navasan/crypto - Fetching crypto rates');
    return this.navasanService.getCrypto();
  }

  /**
   * GET /api/navasan/gold
   * Returns gold coin and gold prices (Sekkeh, Bahar, Nim, Rob, Gerami, 18 Karat)
   */
  @Get('gold')
  async getGold() {
    this.logger.log('GET /api/navasan/gold - Fetching gold prices');
    return this.navasanService.getGold();
  }
}
