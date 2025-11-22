import { IsEnum, IsOptional } from "class-validator";

export enum TimeRange {
  ONE_DAY = "1d",
  ONE_WEEK = "1w",
  ONE_MONTH = "1m",
  THREE_MONTHS = "3m",
  ONE_YEAR = "1y",
  ALL = "all",
}

export enum ItemType {
  CURRENCY = "currency",
  GOLD = "gold",
  CRYPTO = "crypto",
}

export class ChartQueryDto {
  @IsOptional()
  @IsEnum(TimeRange, {
    message: "timeRange must be one of: 1d, 1w, 1m, 3m, 1y, all",
  })
  timeRange?: TimeRange = TimeRange.ONE_MONTH;

  @IsOptional()
  @IsEnum(ItemType, {
    message: "itemType must be one of: currency, gold, crypto",
  })
  itemType?: ItemType = ItemType.CURRENCY;
}
