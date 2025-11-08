import { Types } from 'mongoose';

/** Convert number|string to Decimal128 (throws on NaN) */
export function toDecimal128(value: number | string): Types.Decimal128 {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) throw new Error('Invalid decimal value');
  return Types.Decimal128.fromString(n.toString());
}

/** Convert Decimal128 to number (safe enough for display / sums) */
export function decimal128ToNumber(d: Types.Decimal128 | string | number): number {
  if (typeof d === 'number') return d;
  if (typeof d === 'string') return Number(d);
  return Number(d.toString());
}
