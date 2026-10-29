// es-shimsを参考にした補完。取り込み元と許諾はTHIRD-PARTY-LICENSES.txtを参照。
function __compatIncludes(search, fromIndex) {
  if (this === null || typeof this === "undefined")
    throw new TypeError("includes requires an object");
  var object = Object(this);
  var length = __compatLength(object.length);
  if (length === 0) return false;
  var from = __compatInteger(fromIndex);
  var index = from >= 0 ? from : Math.max(length + from, 0);
  while (index < length) {
    var element = object[index];
    if (element === search || (element !== element && search !== search)) return true;
    index++;
  }
  return false;
}

function __compatIncludesWorks(method) {
  if (typeof method !== "function") return false;
  try {
    return (
      method.call([1, 2], 2) &&
      method.call([NaN], NaN) &&
      !method.call(["a"], "b") &&
      !method.call([1, 2], 1, 1) &&
      method.call([1, 2], 1, -Infinity) &&
      method.call({ length: 1 }, undefined)
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
