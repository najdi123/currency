import { IsString, IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';

export class CreateGoldDto {
  @IsString()
  type!: string;

  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  priceInToman!: number;

  @IsString()
  unit!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

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
  @Max(100)
  purity?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
