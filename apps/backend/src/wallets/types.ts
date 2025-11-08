export type CurrencyType = 'fiat' | 'crypto' | 'gold';

export type TransactionReason =
  | 'deposit'
  | 'withdrawal'
  | 'transfer'
  | 'adjustment';

export type TransactionDirection = 'credit' | 'debit';
