/** AEで置換できないNumberに依存せず、数値変換を明示的に補正する。 */
export function toNumber(value) {
  if (arguments.length === 0) return 0;
  var nativeNumber = Number;
  if (value !== null && (typeof value === "object" || typeof value === "function")) {
    var primitive = value;
    var method;
    var exotic =
      typeof Symbol === "function" && Symbol.toPrimitive ? value[Symbol.toPrimitive] : undefined;
    if (exotic !== undefined && exotic !== null) {
      if (typeof exotic !== "function")
        throw new TypeError("Cannot convert object to primitive value");
      primitive = exotic.call(value, "number");
    } else {
      method = value.valueOf;
      if (typeof method === "function") primitive = method.call(value);
      if (
        primitive !== null &&
        (typeof primitive === "object" || typeof primitive === "function")
      ) {
        method = value.toString;
        if (typeof method === "function") primitive = method.call(value);
      }
    }
    if (primitive !== null && (typeof primitive === "object" || typeof primitive === "function")) {
      throw new TypeError("Cannot convert object to primitive value");
    }
    value = primitive;
  }
  if (typeof value !== "string") return nativeNumber(value);

  // ExtendScriptの正規表現に依存せず、現在のECMAScriptの空白を端から取り除く。
  var start = 0;
  var end = value.length;
  while (start < end && isNumberWhitespace(value.charCodeAt(start))) start++;
  while (end > start && isNumberWhitespace(value.charCodeAt(end - 1))) end--;
  value = value.slice(start, end);
  if (value === "") return 0;
  if (/^0[bB][01]+$/.test(value)) return parseInt(value.slice(2), 2);
  if (/^0[oO][0-7]+$/.test(value)) return parseInt(value.slice(2), 8);
  if (
    !/^(?:0[xX][0-9a-fA-F]+|[+-]?(?:Infinity|(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?))$/.test(
      value
    )
  )
    return NaN;
  return nativeNumber(value);
}

/** @param {number} code */
function isNumberWhitespace(code) {
  return (
    (code >= 0x09 && code <= 0x0d) ||
    code === 0x20 ||
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  );
}
