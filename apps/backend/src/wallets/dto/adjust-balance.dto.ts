import { IsEnum, IsNotEmpty, IsNumberString, IsOptional, IsString, IsMongoId, Length, Matches, MaxLength } from 'class-validator';
import { CurrencyType, TransactionDirection, TransactionReason } from '../types';

export class AdjustBalanceDto {
  @IsEnum(['fiat','crypto','gold'] as const)
  currencyType!: CurrencyType;

  @IsString()
  @Length(3, 10)
  @Matches(/^[A-Z0-9_-]+$/i)
  currencyCode!: string;

  @IsEnum(['credit','debit'] as const)
  direction!: TransactionDirection;

  /** send as string to preserve precision on the wire */
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,8})?$/, {
    message: 'Amount must be a positive number with up to 8 decimal places'
  })
  @MaxLength(20)
  amount!: string;

  @IsEnum(['deposit','withdrawal','transfer','adjustment'] as const)
  reason!: TransactionReason;

  @IsOptional()
  @IsMongoId()
  requestId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Idempotency key must contain only alphanumeric characters, underscores, and hyphens'
  })
  idempotencyKey?: string;
}
