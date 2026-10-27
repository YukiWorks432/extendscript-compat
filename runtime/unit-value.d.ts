/**
 * The public measurement-value shape used by the helper APIs on the host's UnitValue.
 *
 * ホストのUnitValueが持つ、補助APIで利用する測定値の公開部分。
 */
export interface UnitValueLike {
  value: number;
  type: string;
  baseUnit: UnitValueLike | null;
  as(unit: string): number;
  convert(unit: string): boolean;
}

export function subtractUnitValues(left: number, right: number): number;
export function subtractUnitValues(left: number, right: UnitValueLike): UnitValueLike;
export function subtractUnitValues(
  left: UnitValueLike,
  right: number | UnitValueLike,
): UnitValueLike;
/**
 * Distinguish UnitValue first, then determine whether the value is null.
 *
 * UnitValueを先に区別してからnullを判定する。
 */
export function isNull(value: unknown): value is null;
