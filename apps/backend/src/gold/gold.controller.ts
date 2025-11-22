import { Controller, Get, Param, Query } from "@nestjs/common";
import { GoldService } from "./gold.service";

@Controller("gold")
export class GoldController {
  constructor(private readonly goldService: GoldService) {}

  @Get("code/:code/history")
  getHistory(@Param("code") code: string, @Query("days") days?: string) {
    const daysNumber = days ? parseInt(days, 10) : 7;
    return this.goldService.getHistory(code, daysNumber);
  }
}
