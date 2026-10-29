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

/* oxlint-disable no-new-array -- ES3の配列長上限を検査し、指定長で配列を生成する */
// 配列を変更しないコピー操作と末尾検索。ECMAScriptとes-shimsを参考にする。
function __compatToReversed() {
  if (this === null || typeof this === "undefined")
    throw new TypeError("toReversed requires an object");
  var source = Object(this),
    length = __compatLength(source.length),
    result = new Array(length);
  for (var i = 0; i < length; i++) result[i] = source[length - i - 1];
  return result;
}
function __compatToSorted(compare) {
  if (typeof compare !== "undefined" && typeof compare !== "function")
    throw new TypeError("compare must be a function");
  if (this === null || typeof this === "undefined")
    throw new TypeError("toSorted requires an object");
  var source = Object(this),
    length = __compatLength(source.length),
    result = new Array(length);
  for (var i = 0; i < length; i++) result[i] = source[i];
  // ホストのsortの安定性に依存せず、同順位の順序を保つ。
  var temporary = new Array(length);
  for (var width = 1; width < length; width *= 2) {
    for (var start = 0; start < length; start += width * 2) {
      var middle = Math.min(start + width, length),
        end = Math.min(start + width * 2, length);
      var left = start,
        right = middle;
      for (var k = start; k < end; k++) {
        if (
          right >= end ||
          (left < middle && __compatSortCompare(result[left], result[right], compare) <= 0)
        )
          temporary[k] = result[left++];
        else temporary[k] = result[right++];
      }
    }
    var swap = result;
    result = temporary;
    temporary = swap;
  }
  return result;
}
function __compatSortCompare(a, b, compare) {
  if (typeof a === "undefined") return typeof b === "undefined" ? 0 : 1;
  if (typeof b === "undefined") return -1;
  if (typeof compare === "function") {
    var compared = compare(a, b);
    if (typeof compared === "bigint") throw new TypeError("Cannot convert BigInt comparison");
    var number = toNumber(compared);
    return number !== number ? 0 : number;
  }
  if (typeof a === "symbol" || typeof b === "symbol")
    throw new TypeError("Cannot sort Symbol values");
  var x = String(a),
    y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
function __compatToSpliced(start, deleteCount) {
  if (this === null || typeof this === "undefined")
    throw new TypeError("toSpliced requires an object");
  var source = Object(this),
    length = __compatLength(source.length),
    relative = __compatInteger(start);
  var actual = relative < 0 ? Math.max(length + relative, 0) : Math.min(relative, length);
  var inserted = Math.max(arguments.length - 2, 0);
  var removed =
    arguments.length === 0
      ? 0
      : arguments.length === 1
        ? length - actual
        : Math.min(Math.max(__compatInteger(deleteCount), 0), length - actual);
  var newLength = length + inserted - removed;
  if (newLength > 9007199254740991) throw new TypeError("Array exceeds maximum length");
  var result = new Array(newLength),
    index = 0,
    i;
  for (i = 0; i < actual; i++) result[index++] = source[i];
  for (i = 0; i < inserted; i++) result[index++] = arguments[i + 2];
  for (i = actual + removed; i < length; i++) result[index++] = source[i];
  return result;
}
function __compatFindFromEnd(source, predicate, thisArg, indexOnly) {
  if (source === null || typeof source === "undefined")
    throw new TypeError("findLast requires an object");
  var object = Object(source),
    length = __compatLength(object.length);
  if (typeof predicate !== "function") throw new TypeError("predicate must be a function");
  for (var i = length - 1; i >= 0; i--) {
    var value = object[i];
    if (predicate.call(thisArg, value, i, object)) return indexOnly ? i : value;
  }
  return indexOnly ? -1 : undefined;
}
function __compatFindLast(predicate, thisArg) {
  return __compatFindFromEnd(this, predicate, thisArg, false);
}
function __compatFindLastIndex(predicate, thisArg) {
  return __compatFindFromEnd(this, predicate, thisArg, true);
}
function __compatCopyMethodWorks(method, name) {
  if (typeof method !== "function") return false;
  try {
    var a = [3, 1, 2],
      result;
    if (name === "toSorted") {
      result = method.call(a);
      var stable = method.call(
        [
          { n: 1, id: 1 },
          { n: 1, id: 2 },
        ],
        function (x, y) {
          return x.n - y.n;
        },
      );
      return result.join(",") === "1,2,3" && a[0] === 3 && stable[0].id === 1;
    }
    if (name === "toReversed") {
      result = method.call(a);
      return result.join(",") === "2,1,3" && a[0] === 3;
    }
    if (name === "toSpliced") {
      result = method.call(a, "0b1", 1, 9);
      return result.join(",") === "3,9,2" && a[1] === 1;
    }
    var visited = [];
    result = method.call({ 0: 1, length: 2 }, function (value, index) {
      visited.push(index);
      return value === 1;
    });
    return result === (name === "findLast" ? 1 : 0) && visited.join(",") === "1,0";
    // oxlint-disable-next-line no-unused-vars -- ES3 requires a catch binding
  } catch (_error) {
    return false;
  }
}
