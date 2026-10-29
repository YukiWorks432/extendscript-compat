var __compatOwn,
  __compatStringOwnBroken,
  __compatArrayLengthBroken,
  __compatStringLengthBroken,
  __compatFunctionLengthBroken,
  __compatFunctionNameBroken;

if (root.__extendscriptCompatESNext1__ !== 1) {
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
  root.__extendscriptCompatESNext1__ = 1;
}

if (root.__extendscriptCompatESNext2__ !== 1) {
  if (!__compatObjectWorks(Object.entries, true))
    __compatInstall(Object, "entries", __compatEntries);
  if (!__compatObjectWorks(Object.values, false)) __compatInstall(Object, "values", __compatValues);
  if (!__compatFlatWorks(Array.prototype.flat, false))
    __compatInstall(Array.prototype, "flat", __compatFlat);
  if (!__compatFlatWorks(Array.prototype.flatMap, true))
    __compatInstall(Array.prototype, "flatMap", __compatFlatMap);
  if (!__compatStringAtWorks(String.prototype.at))
    __compatInstall(String.prototype, "at", __compatStringAt);
  root.__extendscriptCompatESNext2__ = 1;
}

if (root.__extendscriptCompatESNext3__ !== 1) {
  __compatOwn = Object.prototype.hasOwnProperty;
  __compatStringOwnBroken = !__compatOwn.call(Object("x"), "0");
  __compatArrayLengthBroken = !__compatOwn.call([], "length");
  __compatStringLengthBroken = !__compatOwn.call(Object("x"), "length");
  __compatFunctionLengthBroken = !__compatOwn.call(function () {}, "length");
  __compatFunctionNameBroken = !__compatOwn.call(function named() {}, "name");
  if (!__compatArrayAtWorks(Array.prototype.at))
    __compatInstall(Array.prototype, "at", __compatArrayAt);
  if (!__compatHasOwnWorks(Object.hasOwn)) __compatInstall(Object, "hasOwn", __compatHasOwn);
  root.__extendscriptCompatESNext3__ = 1;
}

if (root.__extendscriptCompatStringModern__ !== 1) {
  if (!__compatModernStringWorks(String.prototype.replaceAll, "replaceAll"))
    __compatInstall(String.prototype, "replaceAll", __compatReplaceAll);
  if (!__compatModernStringWorks(String.prototype.isWellFormed, "isWellFormed"))
    __compatInstall(String.prototype, "isWellFormed", __compatIsWellFormed);
  if (!__compatModernStringWorks(String.prototype.toWellFormed, "toWellFormed"))
    __compatInstall(String.prototype, "toWellFormed", __compatToWellFormed);
  root.__extendscriptCompatStringModern__ = 1;
}
