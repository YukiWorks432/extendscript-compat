// 補完実装と元の関数参照をバンドル内に保持する。ホストには導入済み印を置かない。
var __ponyfillCache;

function __createPonyfills() {
  var __nativeGlobals = {
    Symbol: typeof Symbol === "undefined" ? undefined : Symbol,
    Reflect: {},
  };
  var __iteratorKey =
    (__nativeGlobals.Symbol && __nativeGlobals.Symbol.iterator) || "_es6-shim iterator_";
  /* ES5 */
  /* ES6 */
  var __stringCorrections = {
    split: String.prototype.split,
    replace: String.prototype.replace,
    charCodeAt: String.prototype.charCodeAt,
    slice: String.prototype.slice,
  };
  var __parseCorrections = { parseInt: parseInt };
  /* CORRECTIONS */
  /* HELPERS */
  var __compatOwn = Object.prototype.hasOwnProperty;
  var __compatStringOwnBroken = !__compatOwn.call(Object("x"), "0");
  var __compatArrayLengthBroken = !__compatOwn.call([], "length");
  var __compatStringLengthBroken = !__compatOwn.call(Object("x"), "length");
  var __compatFunctionLengthBroken = !__compatOwn.call(function () {}, "length");
  var __compatFunctionNameBroken = !__compatOwn.call(function named() {}, "name");
  function __dateBrand(value) {
    try {
      Date.prototype.getTime.call(value);
      return true;
    }
    // oxlint-disable-next-line no-unused-vars -- ES3ではcatch変数が必須。
    catch (_error) {
      return false;
    }
  }
  var __json = {};
  /* JSON */
  /* TABLES */
  var __static = {
    Array: { isArray: __es5.isArray, from: __es6.from, of: __es6.of },
    Object: {
      keys: __es5.keys,
      assign: __es6.assign,
      is: __es6.is,
      entries: __compatEntries,
      values: __compatValues,
      hasOwn: __compatHasOwn,
      defineProperty: Object.defineProperty,
      setPrototypeOf: Object.setPrototypeOf,
    },
    String: { fromCodePoint: __es6.fromCodePoint, raw: __es6.raw },
    Date: {
      now: function () {
        return new Date().getTime();
      },
      parse: __es5.parse,
    },
    JSON: __json,
    Number: {
      parseInt: __parseCorrections.parseInt,
      parseFloat: parseFloat,
      isFinite: function (value) {
        return typeof value === "number" && isFinite(value);
      },
      isNaN: function (value) {
        return value !== value;
      },
      isInteger: function (value) {
        return typeof value === "number" && isFinite(value) && Math.floor(value) === value;
      },
      isSafeInteger: function (value) {
        return __static.Number.isInteger(value) && Math.abs(value) <= 9007199254740991;
      },
      EPSILON: 2.220446049250313e-16,
      MAX_SAFE_INTEGER: 9007199254740991,
      MIN_SAFE_INTEGER: -9007199254740991,
    },
    Math: {},
    Reflect: __nativeGlobals.Reflect,
  };
  var __methods = {
    Array: {},
    String: {},
    Function: { bind: __es5.bind },
    Date: { toString: undefined },
    Number: {},
  };
  var __natives = {
    Array: Array,
    String: String,
    Object: Object,
    Function: Function,
    Number: Number,
    Date: Date,
    Math: Math,
    JSON: typeof JSON === "undefined" ? undefined : JSON,
    Reflect: typeof Reflect === "undefined" ? undefined : Reflect,
  };
  var __original = {},
    __originalStatic = {},
    name,
    key,
    i;
  for (i = 0; i < __staticNames.Math.length; i++) {
    key = __staticNames.Math[i];
    __static.Math[key] = __es6[key];
  }
  for (i = 0; i < __staticNames.Reflect.length; i++) {
    key = __staticNames.Reflect[i];
    var supported = true;
    if (key === "ownKeys") supported = typeof Object.getOwnPropertyNames === "function";
    else if (key === "isExtensible" || key === "preventExtensions")
      supported = typeof Object.preventExtensions === "function";
    else if (key === "getPrototypeOf") supported = typeof Object.getPrototypeOf === "function";
    else if (key === "setPrototypeOf")
      supported =
        typeof Object.setPrototypeOf === "function" && typeof Object.getPrototypeOf === "function";
    else if (
      key === "defineProperty" ||
      key === "getOwnPropertyDescriptor" ||
      key === "get" ||
      key === "set"
    )
      supported =
        typeof Object.defineProperty === "function" &&
        typeof Object.getOwnPropertyDescriptor === "function";
    if (supported) __static.Reflect[key] = __es6["reflect_" + key];
  }
  var modernArray = {
    includes: __compatIncludes,
    at: __compatArrayAt,
    flat: __compatFlat,
    flatMap: __compatFlatMap,
    toSorted: __compatToSorted,
    toReversed: __compatToReversed,
    toSpliced: __compatToSpliced,
    findLast: __compatFindLast,
    findLastIndex: __compatFindLastIndex,
  };
  var modernString = {
    charAt: __stringCorrections.charAt,
    split: __stringCorrections.split,
    replace: __stringCorrections.replace,
    trim: __extendscriptCompatTrimMethod,
    substr: __es5.substr,
    lastIndexOf: __es5.lastIndexOfString,
    at: __compatStringAt,
    padStart: __compatPadStart,
    padEnd: __compatPadEnd,
    trimStart: __compatTrimStart,
    trimEnd: __compatTrimEnd,
    trimLeft: __compatTrimStart,
    trimRight: __compatTrimEnd,
    replaceAll: __compatReplaceAll,
    isWellFormed: __compatIsWellFormed,
    toWellFormed: __compatToWellFormed,
  };
  for (name in __prototypeNames) {
    if (!__compatOwn.call(__prototypeNames, name)) continue;
    __original[name] = name === "Date" ? { toString: undefined } : {};
    for (i = 0; i < __prototypeNames[name].length; i++) {
      key = __prototypeNames[name][i];
      __original[name][key] = __natives[name].prototype[key];
      if (name === "Array")
        __methods[name][key] = modernArray[key] || __es5[key] || __es6["array_" + key];
      else if (name === "String")
        __methods[name][key] = modernString[key] || __es6["string_" + key];
      else if (name === "Date") __methods[name][key] = __es5["date_" + key];
      else if (name === "Number") __methods[name][key] = __es5[key];
    }
  }
  for (name in __staticNames) {
    if (!__compatOwn.call(__staticNames, name)) continue;
    __originalStatic[name] = {};
    for (i = 0; i < __staticNames[name].length; i++) {
      key = __staticNames[name][i];
      __originalStatic[name][key] = __natives[name] && __natives[name][key];
    }
  }
  return {
    statics: __static,
    methods: __methods,
    natives: __natives,
    original: __original,
    originalStatic: __originalStatic,
  };
}

function __ponyfills() {
  if (!__ponyfillCache) __ponyfillCache = __createPonyfills();
  return __ponyfillCache;
}

export function getStatic(group, key) {
  var registry = __ponyfills();
  var hostConstructor = registry.natives[group];
  var actual = hostConstructor && hostConstructor[key];
  return actual !== registry.originalStatic[group][key] ? actual : registry.statics[group][key];
}

export function getPrototypeMethod(group, key) {
  var registry = __ponyfills();
  var actual = registry.natives[group].prototype[key];
  return actual !== registry.original[group][key] ? actual : registry.methods[group][key];
}

export function getMethod(receiver, key) {
  if (receiver === null || typeof receiver === "undefined")
    throw new TypeError("Cannot read a method of null or undefined");
  var registry = __ponyfills();
  var actual = receiver[key];
  // 独自メソッドや明示的なundefinedは、そのオブジェクトの契約として保持する。
  if (Object.prototype.hasOwnProperty.call(Object(receiver), key)) {
    for (var name in registry.methods) {
      if (receiver === registry.natives[name].prototype) return getPrototypeMethod(name, key);
    }
    return actual;
  }
  var group;
  if (typeof receiver === "function") group = "Function";
  else if (typeof receiver === "string") group = "String";
  else if (typeof receiver === "number") group = "Number";
  else {
    // 型の判別だけで利用側のtoStringTagやvalueOfを呼ばない。
    var inherits = Object.prototype.isPrototypeOf;
    if (inherits.call(Array.prototype, receiver)) group = "Array";
    else if (inherits.call(String.prototype, receiver)) group = "String";
    else if (inherits.call(Number.prototype, receiver)) group = "Number";
    else if (inherits.call(Date.prototype, receiver)) group = "Date";
  }
  if (!group || !Object.prototype.hasOwnProperty.call(registry.methods[group], key)) return actual;
  if (
    actual === registry.original[group][key] &&
    (typeof actual !== "undefined" || !(key in Object(receiver)))
  )
    return registry.methods[group][key];
  return actual;
}

export function getParseInt() {
  return __ponyfills().statics.Number.parseInt;
}

export function callMethod(receiver, method) {
  // 呼び出し不能な値でも、利用側の引数を評価し終えてからTypeErrorにする。
  var args = Array.prototype.slice.call(arguments, 2);
  return Function.prototype.apply.call(method, receiver, args);
}
