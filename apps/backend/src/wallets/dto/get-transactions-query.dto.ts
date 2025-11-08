import { IsOptional, IsEnum, IsString, Length, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class GetTransactionsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by currency code',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  @Length(3, 10)
  @Matches(/^[A-Z0-9_-]+$/i)
  currencyCode?: string;

  @ApiPropertyOptional({
    description: 'Filter by transaction direction',
    enum: ['credit', 'debit'],
    example: 'credit',
  })
  @IsOptional()
  @IsEnum(['credit', 'debit'])
  direction?: 'credit' | 'debit';
}
