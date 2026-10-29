// es-shimsの各実装とECMAScriptを参考に、ExtendScriptの列挙と配列の挙動を補う。
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
function __compatFlatten(source, length, depth, target, targetIndex, mapper, thisArg) {
  for (var i = 0; i < length; i++) {
    if (!(i in source)) continue;
    var element = source[i];
    if (mapper) element = mapper.call(thisArg, element, i, source);
    if (depth > 0 && Array.isArray(element)) {
      targetIndex = __compatFlatten(
        element,
        __compatLength(element.length),
        depth - 1,
        target,
        targetIndex,
        null,
        undefined,
      );
    } else {
      if (targetIndex >= 9007199254740991)
        throw new TypeError("Flattened array exceeds maximum length");
      target[targetIndex++] = element;
    }
  }
  return targetIndex;
}
function __compatFlat(depth) {
  if (this === null || typeof this === "undefined") throw new TypeError("flat requires an object");
  var source = Object(this),
    length = __compatLength(source.length);
  var level = typeof depth === "undefined" ? 1 : __compatInteger(depth);
  var result = [];
  __compatFlatten(source, length, level, result, 0, null, undefined);
  return result;
}
function __compatFlatMap(mapper, thisArg) {
  if (this === null || typeof this === "undefined")
    throw new TypeError("flatMap requires an object");
  var source = Object(this),
    length = __compatLength(source.length);
  if (typeof mapper !== "function") throw new TypeError("flatMap requires a function");
  var result = [];
  __compatFlatten(source, length, 1, result, 0, mapper, thisArg);
  return result;
}
function __compatFlatWorks(method, mapped) {
  if (typeof method !== "function") return false;
  try {
    var a = [1, 2, 3];
    delete a[1];
    var r = mapped
      ? method.call(a, function (x) {
          return [x, x];
        })
      : method.call([a]);
    return mapped
      ? r.length === 4 && r[0] === 1 && r[1] === 1 && r[2] === 3
      : r.length === 2 && r[0] === 1 && r[1] === 3;
    // oxlint-disable-next-line no-unused-vars -- ES3 requires a catch binding
  } catch (_error) {
    return false;
  }
}
function __compatStringAt(index) {
  if (this === null || typeof this === "undefined") throw new TypeError("at requires an object");
  var text = String(this),
    length = text.length,
    relative = __compatInteger(index);
  var actual = relative >= 0 ? relative : length + relative;
  return actual < 0 || actual >= length ? undefined : text.charAt(actual);
}
function __compatStringAtWorks(method) {
  if (typeof method !== "function") return false;
  try {
    return (
      method.call("abc", -1) === "c" &&
      typeof method.call("abc", 3) === "undefined" &&
      method.call("abc", "0b10") === "c" &&
      method.call(String.fromCharCode(0xd83d, 0xde00), 0).length === 1
    );
    // oxlint-disable-next-line no-unused-vars -- ES3 requires a catch binding
  } catch (_error) {
    return false;
  }
}
if (!__compatObjectWorks(Object.entries, true)) __compatInstall(Object, "entries", __compatEntries);
if (!__compatObjectWorks(Object.values, false)) __compatInstall(Object, "values", __compatValues);
if (!__compatFlatWorks(Array.prototype.flat, false))
  __compatInstall(Array.prototype, "flat", __compatFlat);
if (!__compatFlatWorks(Array.prototype.flatMap, true))
  __compatInstall(Array.prototype, "flatMap", __compatFlatMap);
if (!__compatStringAtWorks(String.prototype.at))
  __compatInstall(String.prototype, "at", __compatStringAt);
