// ExtendScript の正規表現に依存せず、UTF-16 の符号単位で空白を判定する。
function __extendscriptCompatIsTrimSpace(code) {
  return (
    (code >= 9 && code <= 13) ||
    code === 32 ||
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  );
}

function __extendscriptCompatTrim(text) {
  var start = 0;
  var end = text.length;
  while (start < end && __extendscriptCompatIsTrimSpace(text.charCodeAt(start))) start++;
  while (end > start && __extendscriptCompatIsTrimSpace(text.charCodeAt(end - 1))) end--;
  return text.slice(start, end);
}

function __extendscriptCompatTrimMethod() {
  if (this === null || typeof this === "undefined") throw new TypeError("trim requires an object");
  return __extendscriptCompatTrim(String(this));
}

function __extendscriptCompatTrimWorks(trim) {
  if (typeof trim !== "function") return false;
  var spaces = [
    9, 10, 11, 12, 13, 32, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006,
    0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
  ];
  var nonspaces = [0x85, 0x180e, 0x200b, 0x200c, 0x200d, 0xfffe];
  var i, c;
  try {
    for (i = 0; i < spaces.length; i++) {
      c = String.fromCharCode(spaces[i]);
      if (trim.call(c + "x" + c) !== "x") return false;
    }
    for (i = 0; i < nonspaces.length; i++) {
      c = String.fromCharCode(nonspaces[i]);
      if (trim.call(c + "x" + c) !== c + "x" + c) return false;
    }
    return trim.call(" x y ") === "x y";
    // oxlint-disable-next-line no-unused-vars -- ES3 requires a catch binding
  } catch (_error) {
    return false;
  }
}
