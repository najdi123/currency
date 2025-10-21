import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreateCurrencyDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  symbol!: string;

  @IsNumber()
  @Min(0)
  priceInToman!: number;

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
