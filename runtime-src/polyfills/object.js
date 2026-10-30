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
  var key = __compatPropertyKey(property);
  if (Object.prototype.hasOwnProperty.call(object, key)) return true;
  // AEでは一部の組み込みプロパティの所有属性が取得できない。
  if (key === "length") {
    if (__compatArrayLengthBroken && Array.isArray(object)) return true;
    if (__compatFunctionLengthBroken && typeof object === "function") return true;
  }
  if (key === "name" && __compatFunctionNameBroken && typeof object === "function" && key in object)
    return true;
  if (
    (__compatStringLengthBroken && key === "length") ||
    (__compatStringOwnBroken && typeof key === "string")
  ) {
    // 組み込みのvalueOfで文字列を判別し、toStringTagやlengthの取得処理を呼ばない。
    try {
      var text = String.prototype.valueOf.call(object);
      if (key === "length") return true;
      var number = +key;
      return (
        number >= 0 &&
        number < text.length &&
        Math.floor(number) === number &&
        String(number) === key
      );
      // oxlint-disable-next-line no-unused-vars -- ES3 requires a catch binding
    } catch (_error) {}
  }
  return false;
}

function __compatPropertyKey(value) {
  var key = value;
  if (value !== null && (typeof value === "object" || typeof value === "function")) {
    var exotic =
      typeof Symbol === "function" && Symbol.toPrimitive ? value[Symbol.toPrimitive] : undefined;
    if (exotic !== null && typeof exotic !== "undefined") {
      if (typeof exotic !== "function") throw new TypeError("Invalid property key conversion");
      key = exotic.call(value, "string");
    } else {
      var method = value.toString;
      if (typeof method === "function") key = method.call(value);
      if (key !== null && (typeof key === "object" || typeof key === "function")) {
        method = value.valueOf;
        if (typeof method === "function") key = method.call(value);
      }
    }
    if (key !== null && (typeof key === "object" || typeof key === "function"))
      throw new TypeError("Invalid property key conversion");
  }
  return typeof key === "symbol" ? key : String(key);
}

function __compatHasOwnWorks(method) {
  if (typeof method !== "function") return false;
  try {
    var obj = { hasOwnProperty: 1 };
    if (typeof Symbol === "function") {
      var symbol = Symbol("key");
      obj[symbol] = 1;
      if (
        !method(obj, {
          toString: function () {
            return symbol;
          },
        })
      )
        return false;
      if (Symbol.toStringTag && typeof Object.defineProperty === "function") {
        var tagged = {};
        Object.defineProperty(tagged, Symbol.toStringTag, {
          get: function () {
            throw new Error("Unexpected tag access");
          },
        });
        if (method(tagged, "missing")) return false;
      }
    }
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
