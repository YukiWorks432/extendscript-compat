// es-shimsを参考にした補完。取り込み元と許諾はTHIRD-PARTY-LICENSES.txtを参照。
function __compatPad(text, maxLength, filler, atStart) {
  var length = __compatLength(maxLength);
  if (length <= text.length) return text;
  var fill = typeof filler === "undefined" ? " " : String(filler);
  if (fill === "") return text;
  var needed = length - text.length;
  var padding = "";
  while (padding.length < needed) {
    if (needed - padding.length < fill.length) padding += fill.slice(0, needed - padding.length);
    else padding += fill;
    if (fill.length < needed - padding.length) fill += fill;
  }
  return atStart ? padding + text : text + padding;
}

function __compatPadStart(maxLength, filler) {
  if (this === null || typeof this === "undefined")
    throw new TypeError("padStart requires an object");
  return __compatPad(String(this), maxLength, filler, true);
}

function __compatPadEnd(maxLength, filler) {
  if (this === null || typeof this === "undefined")
    throw new TypeError("padEnd requires an object");
  return __compatPad(String(this), maxLength, filler, false);
}

function __compatPadWorks(method, atStart) {
  if (typeof method !== "function") return false;
  try {
    return (
      method.call("x", 3) === (atStart ? "  x" : "x  ") &&
      method.call("x", 3, "") === "x" &&
      method.call("x", 4, "ab") === (atStart ? "abax" : "xaba") &&
      method.call("x", "0b11", "0") === (atStart ? "00x" : "x00")
    );
    // oxlint-disable-next-line no-unused-vars -- ES3 requires a catch binding
  } catch (_error) {
    return false;
  }
}

function __compatTrimStart() {
  if (this === null || typeof this === "undefined")
    throw new TypeError("trimStart requires an object");
  var text = String(this),
    index = 0;
  while (index < text.length && isNumberWhitespace(text.charCodeAt(index))) index++;
  return text.slice(index);
}

function __compatTrimEnd() {
  if (this === null || typeof this === "undefined")
    throw new TypeError("trimEnd requires an object");
  var text = String(this),
    index = text.length;
  while (index > 0 && isNumberWhitespace(text.charCodeAt(index - 1))) index--;
  return text.slice(0, index);
}

function __compatTrimWorks(method, atStart) {
  if (typeof method !== "function") return false;
  var spaces = [
    9, 10, 11, 12, 13, 32, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006,
    0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
  ];
  var nonspaces = [0x85, 0x180e, 0x200b, 0x200c, 0x200d, 0xfffe];
  try {
    for (var i = 0; i < spaces.length; i++) {
      var c = String.fromCharCode(spaces[i]);
      if (method.call(c + "x" + c) !== (atStart ? "x" + c : c + "x")) return false;
    }
    for (var j = 0; j < nonspaces.length; j++) {
      var n = String.fromCharCode(nonspaces[j]);
      if (method.call(n + "x" + n) !== n + "x" + n) return false;
    }
    return true;
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

// es-shimsとECMAScriptを参考に、全置換とUTF-16の整形式を補う。
function __compatStringValue(value) {
  if (typeof value === "symbol") throw new TypeError("Cannot convert Symbol to string");
  return String(value);
}
function __compatReplaceAll(searchValue, replaceValue) {
  if (this === null || typeof this === "undefined")
    throw new TypeError("replaceAll requires a value");
  var hasReplaceSymbol = typeof Symbol === "function" && Symbol.replace;
  if (searchValue !== null && typeof searchValue !== "undefined") {
    var actualRegex = __compatRegExpBrand(searchValue);
    var match =
      typeof Symbol === "function" && Symbol.match ? searchValue[Symbol.match] : undefined;
    var isRegex = typeof match === "undefined" ? actualRegex : !!match;
    if (isRegex) {
      // AEはflagsを持たないため、純正RegExpの場合だけglobalから補う。
      var flags =
        actualRegex && !("flags" in Object(searchValue))
          ? searchValue.global
            ? "g"
            : ""
          : searchValue.flags;
      if (flags === null || typeof flags === "undefined")
        throw new TypeError("RegExp flags required");
      if (__compatStringValue(flags).indexOf("g") < 0)
        throw new TypeError("replaceAll requires a global RegExp");
    }
    if (hasReplaceSymbol) {
      var replacer = searchValue[Symbol.replace];
      if (replacer !== null && typeof replacer !== "undefined") {
        if (typeof replacer !== "function")
          throw new TypeError("Symbol.replace must be a function");
        return replacer.call(searchValue, this, replaceValue);
      }
    } else if (isRegex) {
      var input = __compatStringValue(this);
      var replacementValue =
        typeof replaceValue === "function"
          ? function () {
              return __compatStringValue(replaceValue.apply(undefined, arguments));
            }
          : __compatStringValue(replaceValue);
      // AEのreplaceはlastIndexを初期化しない。変換を済ませてから開始位置を戻す。
      searchValue.lastIndex = 0;
      return String.prototype.replace.call(input, searchValue, replacementValue);
    }
  }
  var text = __compatStringValue(this),
    search = __compatStringValue(searchValue);
  var functional = typeof replaceValue === "function";
  var replacement = functional ? "" : __compatStringValue(replaceValue);
  var position = text.indexOf(search),
    cursor = 0,
    result = "";
  while (position >= 0) {
    var substituted = functional
      ? __compatStringValue(replaceValue(search, position, text))
      : __compatLiteralSubstitution(replacement, search, text, position);
    result += text.slice(cursor, position) + substituted;
    cursor = position + search.length;
    var next = position + Math.max(1, search.length);
    if (next > text.length) break;
    position = text.indexOf(search, next);
  }
  return result + text.slice(cursor);
}
function __compatLiteralSubstitution(replacement, matched, text, position) {
  var result = "";
  for (var i = 0; i < replacement.length; i++) {
    if (replacement.charCodeAt(i) === 36) {
      var next = replacement.charCodeAt(i + 1);
      if (next === 36) {
        result += "$";
        i++;
        continue;
      }
      if (next === 38) {
        result += matched;
        i++;
        continue;
      }
      if (next === 96) {
        result += text.slice(0, position);
        i++;
        continue;
      }
      if (next === 39) {
        result += text.slice(position + matched.length);
        i++;
        continue;
      }
    }
    result += replacement.slice(i, i + 1);
  }
  return result;
}
function __compatWellFormed(text, repair) {
  var result = "",
    cursor = 0;
  for (var i = 0; i < text.length; i++) {
    var code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      var next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        i++;
        continue;
      }
    } else if (code < 0xdc00 || code > 0xdfff) continue;
    if (!repair) return false;
    result += text.slice(cursor, i) + String.fromCharCode(0xfffd);
    cursor = i + 1;
  }
  return repair ? result + text.slice(cursor) : true;
}
function __compatIsWellFormed() {
  if (this === null || typeof this === "undefined")
    throw new TypeError("isWellFormed requires a value");
  return __compatWellFormed(__compatStringValue(this), false);
}
function __compatToWellFormed() {
  if (this === null || typeof this === "undefined")
    throw new TypeError("toWellFormed requires a value");
  return __compatWellFormed(__compatStringValue(this), true);
}
function __compatModernStringWorks(method, name) {
  if (typeof method !== "function") return false;
  try {
    if (name === "replaceAll") {
      var rejected = false;
      try {
        method.call("aa", /a/, "x");
      }
      // oxlint-disable-next-line no-unused-vars -- ES3構文ではcatch変数が必要
      catch (_error) {
        rejected = true;
      }
      return (
        method.call("aba", "a", "x") === "xbx" &&
        method.call("ab", "", "-") === "-a-b-" &&
        method.call("aa", "a", function (match, index) {
          return index;
        }) === "01" &&
        rejected
      );
    }
    var high = String.fromCharCode(0xd800),
      low = String.fromCharCode(0xdc00);
    return name === "isWellFormed"
      ? method.call(high + low) === true &&
          method.call(high) === false &&
          method.call(low) === false
      : method.call(high + low) === high + low &&
          method.call(high) === String.fromCharCode(0xfffd) &&
          method.call(low) === String.fromCharCode(0xfffd);
    // oxlint-disable-next-line no-unused-vars -- ES3構文ではcatch変数が必要
  } catch (_error) {
    return false;
  }
}

function __compatRegExpBrand(value) {
  // Symbol.toStringTagによる誤判定を避け、利用可能なら純正の属性取得で識別する。
  if (typeof Object.getOwnPropertyDescriptor === "function") {
    var descriptor = Object.getOwnPropertyDescriptor(RegExp.prototype, "global");
    if (descriptor && typeof descriptor.get === "function") {
      try {
        descriptor.get.call(value);
        return true;
      }
      // oxlint-disable-next-line no-unused-vars -- ES3構文ではcatch変数が必要
      catch (_error) {
        return false;
      }
    }
  }
  return Object.prototype.toString.call(value) === "[object RegExp]";
}
