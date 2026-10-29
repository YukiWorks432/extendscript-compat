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
