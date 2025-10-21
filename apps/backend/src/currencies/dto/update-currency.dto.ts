import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class UpdateCurrencyDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceInToman?: number;

  @IsOptional()
  @IsNumber()
  changePercentage24h?: number;

  @IsOptional()
  @IsNumber()
  changeAmount24h?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
