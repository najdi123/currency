import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreateDigitalCurrencyDto {
  @IsString()
  symbol!: string;

  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  priceInToman!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  marketCapInToman?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  volumeInToman24h?: number;

  @IsOptional()
  @IsNumber()
  changePercentage24h?: number;

  @IsOptional()
  @IsNumber()
  changeAmount24h?: number;

  @IsOptional()
  @IsNumber()
  changePercentage7d?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  circulatingSupply?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalSupply?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxSupply?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
