/** EC-10の数値−UnitValueだけを補正し、ほかの数値・UnitValueの減算は純正へ委ねる。 */
export function subtractUnitValues(left, right) {
  var hasUnitValue = typeof UnitValue === "function";
  var leftUnit = hasUnitValue && left instanceof UnitValue;
  var rightUnit = hasUnitValue && right instanceof UnitValue;
  if (!leftUnit && typeof left !== "number") throw new TypeError("Expected a number or UnitValue");
  if (!rightUnit && typeof right !== "number")
    throw new TypeError("Expected a number or UnitValue");
  if (typeof left === "number" && rightUnit) {
    var result = new UnitValue(left - right.value, right.type);
    result.baseUnit = right.baseUnit;
    return result;
  }
  return left - right;
}

/** EC-11を避け、UnitValueをnullとして扱わない。共有オブジェクトは変更しない。 */
export function isNull(value) {
  if (typeof UnitValue === "function") {
    if (value instanceof UnitValue) return false;
  }
  return value === null;
}
