// ES2016以降の一部。es-shimsを参考に、現在の仕様に沿ってES3向けに実装する。
// 空の埋め文字と変換の順序は仕様に合わせ、AEの数値変換はtoNumberで補正する。
// 参考元の許諾はTHIRD-PARTY-LICENSES.txtを参照。正常な既存関数は維持する。
function __compatInteger(value) {
  var number = toNumber(value);
  if (number !== number || number === 0) return 0;
  if (number === Infinity || number === -Infinity) return number;
  return (number < 0 ? -1 : 1) * Math.floor(Math.abs(number));
}

function __compatLength(value) {
  var length = __compatInteger(value);
  return length <= 0 ? 0 : Math.min(length, 9007199254740991);
}

function __compatInstall(target, name, implementation) {
  if (typeof Object.defineProperty === "function") {
    try {
      Object.defineProperty(target, name, {
        value: implementation,
        writable: true,
        configurable: true,
        enumerable: false,
      });
      return;
      // oxlint-disable-next-line no-unused-vars -- ES3 requires a catch binding
    } catch (_error) {}
  }
  target[name] = implementation;
}

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

if (!__compatIncludesWorks(Array.prototype.includes))
  __compatInstall(Array.prototype, "includes", __compatIncludes);
if (!__compatPadWorks(String.prototype.padStart, true))
  __compatInstall(String.prototype, "padStart", __compatPadStart);
if (!__compatPadWorks(String.prototype.padEnd, false))
  __compatInstall(String.prototype, "padEnd", __compatPadEnd);
if (!__compatTrimWorks(String.prototype.trimStart, true))
  __compatInstall(String.prototype, "trimStart", __compatTrimStart);
if (!__compatTrimWorks(String.prototype.trimEnd, false))
  __compatInstall(String.prototype, "trimEnd", __compatTrimEnd);
if (String.prototype.trimLeft !== String.prototype.trimStart)
  __compatInstall(String.prototype, "trimLeft", String.prototype.trimStart);
if (String.prototype.trimRight !== String.prototype.trimEnd)
  __compatInstall(String.prototype, "trimRight", String.prototype.trimEnd);
