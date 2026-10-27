# Runtime compatibility corrections

[日本語（正本）](README.ja.md) | English

`extendscript-compat/runtime` is a side-effect-only entry point that adds JSON and selected ES5 and ES6 polyfills and corrects `parseInt`, `String.prototype.charAt`, `split`, and `replace`. The four functions are replaced even when they already exist.

## Installation and load order

Load it before initializing the application or its dependencies. It applies JSON, ES5, and ES6 polyfills in that order, followed by the four corrections. When using other compatibility code, load this entry after it:

```js
import "extendscript-compat/runtime";
```

Bundle it into ordinary host JavaScript with Rollup, and apply `extendscriptCompat()` after minification and include expansion. Imported compatibility code also needs precedence protection. The normal Node.js and `/rollup` entry points do not automatically load these runtime corrections.

You can also include `runtime/index.js` directly in JSX. It uses ES3 syntax and applies the corrections to `$.global` in Adobe hosts. An explicit import in Node.js targets `globalThis`.

The corrections also affect other scripts sharing the engine. References saved to another variable before installation remain unchanged. A versioned internal marker prevents repeated evaluation from wrapping the functions again. If another library subsequently replaces one of the functions, this package does not monitor or automatically undo that change.

## Corrected behavior

| Issue / function   | Correction                                                                                                                                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EC-04 / `parseInt` | Rejects invalid digits for radices 11–36 and automatically detected hexadecimal. Only the valid digit prefix is passed to the original parser, and each conversion is performed once. Omitted-radix legacy octal and behavior for radices up to 10 remain native. |
| EC-05 / `charAt`   | Returns NUL as a one-character string. Out-of-range positions return an empty string; positions use UTF-16 code units.                                                                                                                                            |
| EC-07 / `split`    | Preserves trailing empty elements when splitting with a regular expression. Handles captures, empty matches, the limit, and the caller's `lastIndex`.                                                                                                             |
| EC-08 / `replace`  | Converts nonparticipating captures to empty strings, and expands replacement-string dollar tokens for the match, surrounding context, and captures 1–99. Callbacks receive the original input and position.                                                       |

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

The JSON, ES5, and ES6 polyfills are adapted from a [fixed extendscript-ts-template commit](https://github.com/YukiWorks432/extendscript-ts-template/tree/5fdc02dc818f8263a368166c180b9e4ed93a9453). They retain its shared-engine cache and whitespace changes, with fixes for undefined ES5 whitespace-test values and ES6 global lookup. The template's disabled ESNext polyfill is not included. Copyright notices and license texts are in [third-party licenses](../THIRD-PARTY-LICENSES.txt). `runtime/index.js` is generated ES3 code. In a repository checkout, run `node scripts/build-runtime.mjs` to regenerate it from the internal sources.

## Validation

`test/fixtures/runtime-contract.js` contains 71 cases shared by host and Node tests, comparing behavior with expectations derived from the specification. It is kept outside the product type-checking scope and run in Node and AE.

```sh
pnpm check
node scripts/build-host-runtime-probe.mjs
```

The second command generates minified, precedence-protected output, comparison code for AE, and SHA-256 hashes in `tmp/runtime-host-probe/`. The AE probe compares the original functions, the installed correction, and reapplication; a `finally` block restores the four functions and the internal marker. Normal product integration retains the corrections and does not include that restoration.

Record results with the target product, engine version, and code SHA-256. The AE results and evidence are in the [runtime host validation record](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/runtime-host-validation.md). Other Adobe products have not been tested on a host.
