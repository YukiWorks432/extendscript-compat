// es-shimsを参考にした補完。取り込み元と許諾はTHIRD-PARTY-LICENSES.txtを参照。
function __compatObjectValues(value, entries) {
  if (value === null || typeof value === "undefined")
    throw new TypeError("Object conversion requires a value");
  var object = Object(value);
  var descriptors =
    typeof Object.getOwnPropertyNames === "function" &&
    typeof Object.getOwnPropertyDescriptor === "function";
  var keys = descriptors ? Object.getOwnPropertyNames(object) : Object.keys(object);
  var indexes = [],
    others = [],
    result = [];
  var i, key, number;
  for (i = 0; i < keys.length; i++) {
    key = keys[i];
    number = +key;
    if (
      number >= 0 &&
      number < 4294967295 &&
      Math.floor(number) === number &&
      String(number) === key
    )
      indexes.push(key);
    else others.push(key);
  }
  indexes.sort(function (a, b) {
    return +a - +b;
  });
  keys = indexes.concat(others);
  var isString = Object.prototype.toString.call(object) === "[object String]";
  for (i = 0; i < keys.length; i++) {
    key = keys[i];
    var enumerable;
    if (descriptors) {
      var descriptor = Object.getOwnPropertyDescriptor(object, key);
      enumerable = descriptor && descriptor.enumerable;
    } else {
      // AEでは文字列の位置が所有・列挙属性に現れない場合がある。
      enumerable =
        (isString &&
          +key >= 0 &&
          +key < object.length &&
          String(+key) === key &&
          Math.floor(+key) === +key) ||
        (Object.prototype.hasOwnProperty.call(object, key) &&
          Object.prototype.propertyIsEnumerable.call(object, key));
    }
    if (enumerable) result.push(entries ? [key, object[key]] : object[key]);
  }
  return result;
}

function __compatEntries(value) {
  return __compatObjectValues(value, true);
}

function __compatValues(value) {
  return __compatObjectValues(value, false);
}

function __compatObjectWorks(method, entries) {
  if (typeof method !== "function") return false;
  try {
    var input = {};
    input[2] = "b";
    input[1] = "a";
    input.propertyIsEnumerable = "x";
    var result = method(input);
    return (
      result.length === 3 &&
      (entries
        ? result[0][0] === "1" && result[0][1] === "a" && result[2][0] === "propertyIsEnumerable"
        : result[0] === "a" && result[2] === "x") &&
      method("ab").length === 2
    );
    // oxlint-disable-next-line no-unused-vars -- ES3 requires a catch binding
  } catch (_error) {
    return false;
  }
}

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
