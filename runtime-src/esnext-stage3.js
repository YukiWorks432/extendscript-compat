// es-shimsとECMAScriptを参考に、AEの所有属性と数値変換を補う。
function __compatArrayAt(index) {
  if (this === null || typeof this === "undefined") throw new TypeError("at requires an object");
  var object = Object(this),
    length = __compatLength(object.length);
  var relative = __compatInteger(index);
  var actual = relative >= 0 ? relative : length + relative;
  return actual < 0 || actual >= length ? undefined : object[actual];
}
function __compatArrayAtWorks(method) {
  if (typeof method !== "function") return false;
  try {
    return (
      method.call([1, 2, 3], -1) === 3 &&
      method.call({ 0: "x", length: 1 }, 0) === "x" &&
      typeof method.call([1], 1) === "undefined" &&
      method.call([1, 2, 3], "0b10") === 3
    );
    // oxlint-disable-next-line no-unused-vars -- ES3 requires a catch binding
  } catch (_error) {
    return false;
  }
}
var __compatOwn = Object.prototype.hasOwnProperty;
var __compatStringOwnBroken = !__compatOwn.call(Object("x"), "0");
var __compatArrayLengthBroken = !__compatOwn.call([], "length");
var __compatStringLengthBroken = !__compatOwn.call(Object("x"), "length");
var __compatFunctionLengthBroken = !__compatOwn.call(function () {}, "length");
var __compatFunctionNameBroken = !__compatOwn.call(function named() {}, "name");
function __compatHasOwn(value, property) {
  if (value === null || typeof value === "undefined")
    throw new TypeError("Object conversion requires a value");
  var object = Object(value);
  var key = property;
  // Symbol対応環境ではToPrimitiveがSymbolを返す場合もある。
  if (
    key !== null &&
    (typeof key === "object" || typeof key === "function") &&
    typeof Symbol === "function" &&
    Symbol.toPrimitive
  ) {
    var exotic = key[Symbol.toPrimitive];
    if (exotic != null) {
      if (typeof exotic !== "function") throw new TypeError("Invalid property key conversion");
      key = exotic.call(key, "string");
      if (key !== null && (typeof key === "object" || typeof key === "function"))
        throw new TypeError("Invalid property key conversion");
    }
  }
  if (typeof key !== "symbol") key = String(key);
  if (Object.prototype.hasOwnProperty.call(object, key)) return true;
  var kind = Object.prototype.toString.call(object);
  // AEでは一部の組み込みプロパティの所有属性が取得できない。
  if (
    key === "length" &&
    ((kind === "[object Array]" && __compatArrayLengthBroken) ||
      (kind === "[object String]" && __compatStringLengthBroken) ||
      (kind === "[object Function]" && __compatFunctionLengthBroken))
  )
    return true;
  if (key === "name" && kind === "[object Function]" && __compatFunctionNameBroken && key in object)
    return true;
  if (__compatStringOwnBroken && kind === "[object String]" && typeof key === "string") {
    var number = +key;
    return (
      number >= 0 &&
      number < object.length &&
      Math.floor(number) === number &&
      String(number) === key
    );
  }
  return false;
}
function __compatHasOwnWorks(method) {
  if (typeof method !== "function") return false;
  try {
    var obj = { hasOwnProperty: 1 };
    return (
      method(obj, "hasOwnProperty") &&
      !method(obj, "toString") &&
      method("ab", "0") &&
      method([], "length") &&
      !method("ab", "2")
    );
    // oxlint-disable-next-line no-unused-vars -- ES3 requires a catch binding
  } catch (_error) {
    return false;
  }
}
if (!__compatArrayAtWorks(Array.prototype.at))
  __compatInstall(Array.prototype, "at", __compatArrayAt);
if (!__compatHasOwnWorks(Object.hasOwn)) __compatInstall(Object, "hasOwn", __compatHasOwn);
