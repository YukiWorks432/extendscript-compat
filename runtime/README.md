# Runtime compatibility corrections

[日本語（正本）](README.ja.md) | English

`extendscript-compat/runtime` is a side-effect-only entry point that adds JSON, selected ES5, ES6, and later polyfills, and corrects `parseInt`, `String.prototype.charAt`, `split`, and `replace`. The four functions are replaced even when they already exist.

## Installation and load order

Load it before initializing the application or its dependencies. It applies JSON, ES5, and ES6 polyfills in that order, followed by the four corrections and selected later methods. When using other compatibility code, load this entry after it:

```js
import "extendscript-compat/runtime";
```

Bundle it into ordinary host JavaScript with Rollup, and apply `extendscriptCompat()` after minification and include expansion. Imported compatibility code also needs precedence protection. The normal Node.js and `/rollup` entry points do not automatically load these runtime corrections.

You can also include `runtime/index.js` directly in JSX. It uses ES3 syntax and applies the corrections to `$.global` in Adobe hosts. An explicit import in Node.js targets `globalThis`.

The distributed `runtime/index.js` contains only ASCII. A consumer's bundler or minifier may reintroduce Unicode characters, but a final `extendscriptCompat()` pass corrects U+200C, U+200D, and U+FEFF in strings and regular expressions. It does not guarantee ASCII-only output; verify that separately when needed. See [Unicode protection](../docs/build-compatibility.md#unicode-protection) for its scope and limitations.

The corrections also affect other scripts sharing the engine. References saved to another variable before installation remain unchanged. A versioned internal marker prevents repeated evaluation from wrapping the functions again. If another library subsequently replaces one of the functions, this package does not monitor or automatically undo that change.

JSON has its own installation marker, so it can update an engine where the earlier runtime is already installed. Calls to `JSON.stringify` from a replacer or `toJSON` preserve the outer replacer and indentation. An array replacer accepts string and number keys, including their boxed forms, preserving order and removing duplicates. Its key list is built once before recursion. Existing implementations that pass representative checks are retained.

## Later methods

The runtime supplies `Array.prototype.includes`, `String.prototype.padStart`, `padEnd`, `trimStart`, and `trimEnd`, as well as the aliases `trimLeft` and `trimRight`. It checks representative behavior and replaces missing or incomplete methods. `trimLeft` and `trimRight` become the same functions as `trimStart` and `trimEnd`, respectively. The checks do not detect every possible defect.

```js
[1, 2, NaN].includes(NaN); // true
"7".padStart(3, "0"); // "007"
"  text  ".trimStart(); // "text  "
```

`includes` supports `NaN`, a starting position, and array-like objects. `padStart` and `padEnd` return the original string for an empty filler. Length and position conversion reuses the existing number conversion, including binary and octal strings missing in AE. One-sided trimming uses the same whitespace set as `trim` and preserves characters such as U+180E and U+200B.

The runtime also supplies `Object.entries`, `Object.values`, `Array.prototype.flat`, `flatMap`, and `String.prototype.at`. The object methods return own enumerable string keys, ordering integer indices numerically. `flat` skips deleted elements, and `flatMap` maps and flattens one level. `String.prototype.at` returns a UTF-16 code unit.

In AE 26.5, an omitted element in `[1,,3]` is created as an `undefined` element. It cannot be distinguished from an explicit `undefined`, so `flat` retains it. Holes created with `delete` are removed. The polyfilled `flat` and `flatMap` return ordinary arrays and do not support `Symbol.species` for derived arrays. Where property descriptors are unavailable, `entries` and `values` may differ from the standard if enumerability changes during processing. Key ordering for host-specific objects depends on the host.

`Array.prototype.at` supports negative indices and array-like objects. `Object.hasOwn` excludes inherited properties and compensates for AE's missing ownership attributes for array and string `length`, string indices, and function `length` and `name`. Ownership of host-specific objects and other built-in properties depends on the host.

Importing `/runtime` from TypeScript also supplies declarations for these methods. They work with `lib: ["ES5"]` and do not add declarations for unsupported features such as `Promise`. Syntax transformation remains the consumer's responsibility.

The runtime defines non-enumerable methods where possible. AE 26.5 lacks `Object.defineProperty`, so methods are added by assignment and appear during `for...in` enumeration of prototypes. Check for own properties when enumerating. Host verification covered loading the new runtime after the previous version and re-evaluation. The [second-stage investigation and verification](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/evidence/2026-10-29/ae-26.5/esnext-stage2/esnext-stage2-ae-26.5.json) is recorded separately. See the [verification record](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/evidence/2026-10-29/ae-26.5/esnext-stage1/esnext-stage1-ae-26.5.json).

## Array copying and searching from the end

toSorted follows ECMAScript and es-shims Array.prototype.toSorted, using a stable merge sort independent of AE's sort. The other four methods follow the ECMAScript algorithms.

toSorted, toReversed, and toSpliced return new ordinary arrays without changing the receiver. toSorted uses stable ordering with the default string comparison or a comparator, retaining the order of equal elements. These copying operations read holes as undefined elements. They do not use Symbol.species. Output size is subject to host array length and memory limits.

findLast and findLastIndex search from the end, visiting holes as undefined. Predicates receive the value, index, and source object and support thisArg. BigInt polyfills are outside the scope.

```js
var original = [3, 1, 2];
var sorted = original.toSorted(); // [1, 2, 3]
var reversed = original.toReversed(); // [2, 1, 3]
var spliced = original.toSpliced(1, 1, 9); // [3, 9, 2]
var last = original.findLast(function (value) {
  return value > 1;
}); // 2
```

## Full replacement and well-formed UTF-16

The same `/runtime` import also provides `String.prototype.replaceAll`, `isWellFormed`, and `toWellFormed`. Missing implementations or implementations that fail representative checks are replaced; working existing implementations are retained.

```js
import "extendscript-compat/runtime";

"a.b.a".replaceAll(".", "-"); // "a-b-a"
"aba".replaceAll(/a/g, "x"); // "xbx"
var text = String.fromCharCode(0xd800) + "x";
text.isWellFormed(); // false
text.toWellFormed(); // U+FFFD followed by "x"
```

`replaceAll` handles every string match, empty searches, replacement dollar tokens, and callbacks. A regular expression must have `g` or a `TypeError` is thrown. In AE, the native `RegExp.global` property supplies the missing `flags` information, and the existing `replace` correction handles empty matches, captures, and callbacks. `lastIndex` is reset to zero after replacement-value coercion. Regular-expression engine bugs and newer flags remain outside its scope. Environments that provide `Symbol` also honor `Symbol.match` and `Symbol.replace`; `Symbol` itself is not added.

`isWellFormed` checks for lone surrogates; `toWellFormed` replaces only those code units with U+FFFD. Valid surrogate pairs, NUL, and noncharacters are preserved. These methods do not perform Unicode normalization, escape source characters, add a BOM, or fix source-decoding problems.

## Corrected behavior

| Issue / function   | Correction                                                                                                                                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EC-04 / `parseInt` | Rejects invalid digits for radices 11–36 and automatically detected hexadecimal. Only the valid digit prefix is passed to the original parser, and each conversion is performed once. Omitted-radix legacy octal and behavior for radices up to 10 remain native. |
| EC-05 / `charAt`   | Returns NUL as a one-character string. Out-of-range positions return an empty string; positions use UTF-16 code units.                                                                                                                                            |
| EC-07 / `split`    | Preserves trailing empty elements when splitting with a regular expression. Handles captures, empty matches, the limit, and the caller's `lastIndex`.                                                                                                             |
| EC-08 / `replace`  | Converts nonparticipating captures to empty strings, and expands replacement-string dollar tokens for the match, surrounding context, and captures 1–99. Callbacks receive the original input and position.                                                       |

`String.prototype.trim` removes the whitespace and line terminators defined by current ECMAScript from both ends and preserves non-whitespace characters such as U+180E and U+200B. Existing conforming implementations are retained; missing or incomplete ones are replaced. The existing radix-dependent behavior of `parseInt` is retained. `Number.parseInt` is the same function as the corrected global `parseInt`.

In AE 26.5, the global `Number` constructor itself cannot be replaced, so string conversions such as `Number("0b101")` retain host behavior. This is a separate limitation from the `Number.parseInt` correction. For corrected number conversion, use the side-effect-free `extendscript-compat/number` entry point.

```js
import { toNumber } from "extendscript-compat/number";

toNumber("0b101"); // 5
toNumber(String.fromCharCode(0x200b) + "0"); // NaN
```

`toNumber` handles an absent argument, empty strings, surrounding whitespace, binary and octal strings, and object-to-number conversion. It does not modify the global `Number`; this entry point alone does not correct `Number()`, `new Number()`, `$.global.Number`, or other scripts. Rollup’s `extendscriptCompat()` can [automatically correct](../docs/build-compatibility.md#automatic-number-call-correction) `Number()` calls in modules. It returns a value and does not replace the constructor, its static properties, or `instanceof`. Check conversions of host-specific objects and behavior in other Adobe products in each target environment.

For additional AE differences, `split` handles the failure of a global regular expression to match empty input. `replace` also handles missing callback calls for string searches, intermediate rather than original input passed to callbacks during consecutive replacements, and omitted empty matches at the end.

Like the source template, the runtime supplies JSON, `Array.prototype.map`, `Object.keys`, `Array.from`, and other selected methods. Existing JSON functions that ignore reviver or replacer callbacks are replaced. The fallback `JSON.parse` validates input and then uses `eval`, and accepts some invalid JSON such as trailing commas; do not rely on it for strict input validation. It does not guarantee complete ES5 or ES6 support; `Symbol` and `Promise` are outside its scope. It does not repair capture loss or hangs inside the regular-expression engine or correct `UnitValue` arithmetic and strict comparisons. Use the explicit `UnitValue` helpers below for the latter. Later regular-expression flags and named captures are also outside its scope. Function objects implemented in JavaScript and `this` conversion for `call(null)` / `call(undefined)` in non-strict ES3 do not exactly match native functions.

## Explicit UnitValue helper APIs

`extendscript-compat/unit-value` is a separate entry point without import-time side effects. Include it as an ES module in the host bundle and apply `extendscriptCompat()` after minification. It is not intended to be passed directly to a JSX include.

```js
import { subtractUnitValues, isNull } from "extendscript-compat/unit-value";

var input = new UnitValue("20 px");
input.baseUnit = new UnitValue(1 / 96, "in");
var result = subtractUnitValues(10, input);
// result.value is -10, result.type is px, and result.as("in") is -10/96.
if (!isNull(result)) {
  // The result is still a UnitValue.
}
```

For example, when the right operand is 2 in, calculate the difference as follows:

```js
import { subtractUnitValues, isNull } from "extendscript-compat/unit-value";

var value = new UnitValue("2 in");
var difference = subtractUnitValues(10, value);
// difference is 8 in; value is not modified.
var missing = isNull(value); // false
```

| API                               | Contract                                                                                                                                                                                                                                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subtractUnitValues(left, right)` | Arguments must be numbers or host `UnitValue` instances. Only number-minus-`UnitValue` is corrected: a new native `UnitValue` inherits the right operand's unit and `baseUnit` without changing either input. Other combinations use native subtraction. Non-number coercion is not performed; invalid arguments throw `TypeError`. |
| `isNull(value)`                   | Returns `false` for a `UnitValue` and otherwise uses strict comparison with `null`. Even a `UnitValue` with an absolute value below 1 is not treated as `null`. It does not normalize operator overrides of unrelated custom classes.                                                                                               |

`UnitValueLike` in the type declarations describes the required public shape. At runtime the subtraction helper checks for the host's actual `UnitValue`, so a normal object with a similar structure is not accepted. Representations of `NaN` and infinity follow the native constructor.

In AE, overriding an instance's operator after obtaining the original operator did not take effect in one observed case. Prototype changes also failed to correct new instances. The library therefore uses explicit helpers that preserve the original class. Importing `/runtime` does not guarantee that ordinary operators or comparisons are fixed.

## Source and modifications

`split` incorporates [es5-shim v4.6.7](https://github.com/es-shims/es5-shim/blob/c0867fc232177277f2f74c6066aad47ade51076c/es5-shim.js#L1980-L2076), commit `c0867fc232177277f2f74c6066aad47ade51076c`, under the MIT license. The [copyright notice and license](../THIRD-PARTY-LICENSES.txt) are included.

Changes from the original cover ES3 flags, forced replacement, shared-engine re-evaluation prevention, one-time input coercion, and AE empty-input handling. String-separator `split` is delegated to the original function. The original correction for nonparticipating captures is retained.

`parseInt`, `charAt`, and `replace` are implemented for ExtendScript-specific bugs observed in this investigation. es5-shim's `parseInt` delegates to the original function and does not fix EC-04; its existing `replace` correction does not cover the replacement-string issue addressed here, so those implementations were not adopted unchanged.

The ES5 and ES6 polyfills are adapted from a [fixed extendscript-ts-template commit](https://github.com/YukiWorks432/extendscript-ts-template/tree/5fdc02dc818f8263a368166c180b9e4ed93a9453). They retain its shared-engine cache, with corrections to ES5 whitespace checks, ES6 global lookup, and trim whitespace handling. The trim correction tests UTF-16 code units without relying on regular expressions. The disabled ES Next polyfill from the template was not copied. The added methods were implemented for ES3 with reference to es-shims `array-includes`, `String.prototype.padStart`, and `String.prototype.trimStart`, and adjusted for current empty-filler and conversion-order requirements and AE number conversion. The third stage also draws on es-shims `Array.prototype.at` and `Object.hasOwn`. The second stage also draws on es-shims `Object.entries`, `Object.values`, `Array.prototype.flat`, `Array.prototype.flatMap`, and `String.prototype.at`, with adjustments for AE enumeration and strings. Copyright notices and license texts are in [third-party licenses](../THIRD-PARTY-LICENSES.txt). `runtime/index.js` is generated ES3 code. In a repository checkout, run `node scripts/build-runtime.mjs` to regenerate it from the internal sources.

Full replacement and well-formed UTF-16 implementations draw on es-shims [String.prototype.replaceAll](https://github.com/es-shims/String.prototype.replaceAll/blob/139da66df7281142d1c49c46ffcecfb4fbaab0a0/implementation.js), [String.prototype.isWellFormed](https://github.com/es-shims/String.prototype.isWellFormed/blob/b6c2a6bbb961337854301160d4288b30efc48106/implementation.js), [String.prototype.toWellFormed](https://github.com/es-shims/String.prototype.toWellFormed/blob/591e5971d2a428a9bb400014785cb061b4bc3b3a/implementation.js) and current ECMAScript. Abstract operations are implemented directly for ES3, with AE-specific corrections for missing flags, replacement callbacks, and lastIndex. Copyright notices and licenses from these fixed commits are included in [third-party licenses](../THIRD-PARTY-LICENSES.txt).

The JSON fallback is adapted from a [fixed public-domain JSON-js commit](https://github.com/douglascrockford/JSON-js/blob/7e83f38a2312429fd4933169c1f6a27fd65e889c/json2.js). Readable source is retained in `runtime-src/vendor/json2.js`, with local corrections for per-call stringify state and array replacer keys. The parse algorithm and its documented limitations are retained.

## Validation

`test/contracts/runtime-contract.js` contains 73 cases shared by host and Node tests, comparing behavior with expectations derived from the specification. It is kept outside the product type-checking scope and can be run in Node and AE. All 73 cases, including the two new cases for word boundaries at the end, were also verified in AE 26.5.

```sh
pnpm check
node scripts/build-host-runtime-probe.mjs
```

The second command generates minified, precedence-protected output, comparison code for AE, and SHA-256 hashes in `tmp/runtime-host-probe/`. The AE probe compares the original functions, the installed correction, and reapplication; a `finally` block restores the four functions and the internal marker. Normal product integration retains the corrections and does not include that restoration.

Record results with the target product, engine version, and code SHA-256. The AE results and evidence are in the [runtime host validation record](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/runtime-host-validation.md). Other Adobe products have not been tested on a host.

See the repository's [development file layout](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/development-layout.md) for source organization.
