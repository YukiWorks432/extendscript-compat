# Runtime API compatibility matrix

[日本語（正本）](API-COMPATIBILITY.ja.md) | English

This matrix describes the built-in APIs handled by `extendscript-compat/runtime`, based on the bundled implementation as of November 7, 2026. Import `/runtime` before using its features. A standard library type alone does not mean that an API exists at runtime.

“Polyfilled” means the runtime attempts to add a missing API or replace an incomplete implementation; it does not guarantee conformance for every host or input. “Conditional” means an underlying feature, such as host property descriptors, is required. Do not assume APIs absent from this matrix are available. Check the scope and load order of any other polyfills separately.

## JSON and runtime corrections

| API                                           | Runtime behavior                            | Limitations                                                                                                   |
| --------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `JSON.parse`                                  | Polyfilled; existing implementation checked | Rejects invalid JSON grammar; consumers validate application data shapes and value ranges                     |
| `JSON.stringify`                              | Polyfilled; existing implementation checked | Supports nested replacer calls and array replacers                                                            |
| `parseInt`                                    | Existing function also corrected            | Corrects invalid characters in radices 11–36 and hexadecimal; retains behaviors such as legacy octal handling |
| `String.prototype.charAt`, `split`, `replace` | Existing functions also corrected           | Addresses specific NUL, trailing-boundary and replacement bugs, not the entire regular-expression engine      |
| `String.prototype.trim`                       | Polyfilled; existing implementation checked | Handles current whitespace and line terminators                                                               |
| `Number.parseInt`                             | Polyfilled and corrected                    | Same function as corrected global `parseInt`                                                                  |
| `Number(value)`                               | Automatic correction not guaranteed         | Cannot be replaced in AE 26.5; use `toNumber` from `extendscript-compat/number` when needed                   |
| `UnitValue` subtraction and null comparison   | Not automatically corrected                 | Use `subtractUnitValues` and `isNull` from `extendscript-compat/unit-value` when needed                       |

## ES5 and ES2015 polyfills and conditions

When `Object.freeze` is not a function, an identity fallback is installed. It does not freeze property descriptors. Existing functions are retained. Status methods such as `Object.isFrozen` are not added and the fallback does not represent the object as frozen.

The ported compatibility code adds or corrects these APIs. A row does not imply that every listed API was tested on a host; see the validation scope below.

| Target             | APIs                                                                                                                                                                                          | Behavior and limitations                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Function.prototype | `bind`                                                                                                                                                                                        | Polyfilled                                                                                                                                       |
| Array              | `isArray`                                                                                                                                                                                     | Polyfilled                                                                                                                                       |
| Array.prototype    | `forEach`, `map`, `filter`, `every`, `some`, `reduce`, `reduceRight`, `indexOf`, `lastIndexOf`                                                                                                | Polyfilled                                                                                                                                       |
| Array.prototype    | `unshift`, `splice`, `join`, `push`, `slice`, `sort`                                                                                                                                          | Conditionally corrects specific bugs in existing implementations                                                                                 |
| Object             | `keys`                                                                                                                                                                                        | Polyfilled and conditionally corrected                                                                                                           |
| Date               | `now`, `parse`                                                                                                                                                                                | Polyfilled and conditionally corrected; depends on the host Date implementation                                                                  |
| Date.prototype     | `getFullYear`, `getMonth`, `getDate`, `getUTCFullYear`, `getUTCMonth`, `getUTCDate`, `toString`, `toUTCString`, `toDateString`, `toISOString`, `toJSON`                                       | Polyfilled or conditionally corrected for specific bugs                                                                                          |
| Number.prototype   | `toFixed`, `toExponential`, `toPrecision`                                                                                                                                                     | Polyfilled or conditionally corrected for specific bugs                                                                                          |
| String.prototype   | `substr`, `lastIndexOf`                                                                                                                                                                       | Conditionally corrected for specific bugs                                                                                                        |
| String             | `fromCodePoint`, `raw`                                                                                                                                                                        | Polyfilled                                                                                                                                       |
| String.prototype   | `repeat`, `startsWith`, `endsWith`, `includes`, `codePointAt`                                                                                                                                 | Polyfilled and conditionally corrected                                                                                                           |
| Array              | `from`, `of`                                                                                                                                                                                  | Polyfilled; iterable inputs also depend on host capabilities                                                                                     |
| Array.prototype    | `copyWithin`, `fill`, `find`, `findIndex`, `keys`, `values`, `entries`                                                                                                                        | Polyfilled; iteration also depends on host capabilities                                                                                          |
| Number             | `MAX_SAFE_INTEGER`, `MIN_SAFE_INTEGER`, `EPSILON`, `parseFloat`, `isFinite`, `isInteger`, `isSafeInteger`, `isNaN`                                                                            | Polyfilled                                                                                                                                       |
| Object             | `assign`, `is`                                                                                                                                                                                | Polyfilled and conditionally corrected                                                                                                           |
| Math               | `acosh`, `asinh`, `atanh`, `cbrt`, `clz32`, `cosh`, `expm1`, `hypot`, `log2`, `log10`, `log1p`, `sign`, `sinh`, `tanh`, `trunc`, `imul`, `fround`                                             | Polyfilled and conditionally corrected                                                                                                           |
| Object             | `defineProperty`, `setPrototypeOf`                                                                                                                                                            | Conditional behavior requiring underlying capabilities such as property descriptors                                                              |
| Reflect            | `apply`, `construct`, `deleteProperty`, `has`, `ownKeys`, `isExtensible`, `preventExtensions`, `defineProperty`, `getOwnPropertyDescriptor`, `get`, `set`, `getPrototypeOf`, `setPrototypeOf` | Conditional behavior; some operations require underlying capabilities such as property descriptors, so full availability in AE is not guaranteed |

## Later methods

These APIs are polyfilled when missing or incomplete and receive type declarations from `/runtime`. Array declarations also cover `ReadonlyArray`.

| Target           | APIs                                                                        | Main limitations                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Array.prototype  | `includes`, `at`, `findLast`, `findLastIndex`                               | Handles negative `at` positions and holes in searches from the end                                                                      |
| Array.prototype  | `flat`, `flatMap`                                                           | AE distinguishes omitted array-literal elements from holes created with `delete`. Derived arrays via `Symbol.species` are not supported |
| Array.prototype  | `toSorted`, `toReversed`, `toSpliced`                                       | Returns a new ordinary array; falls back to assignment when property definition is unavailable                                          |
| Object           | `entries`, `values`, `hasOwn`                                               | Depends on host behavior for host-specific objects and unavailable property attributes                                                  |
| String.prototype | `at`, `padStart`, `padEnd`, `trimStart`, `trimEnd`, `trimLeft`, `trimRight` | `at` operates on UTF-16 code units                                                                                                      |
| String.prototype | `replaceAll`, `isWellFormed`, `toWellFormed`                                | `replaceAll` requires `g` on regular expressions; the regular-expression engine itself is not polyfilled                                |

See [runtime compatibility](README.md) for detailed behavior and limitations.

## Examples outside the polyfill or not verified

| API                                                                         | Status                                                                                                 |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `Promise`, `Symbol`                                                         | Not polyfilled                                                                                         |
| `Map`, `Set`, `WeakMap`, `WeakSet`, `Proxy`                                 | This runtime does not polyfill these constructors; availability depends on the host or other polyfills |
| `Object.fromEntries`, `Array.prototype.with`                                | Not polyfilled by this runtime; availability depends on the host or other polyfills                    |
| `String.prototype.matchAll`, `Object.getOwnPropertyDescriptors`             | Not polyfilled by this runtime; availability depends on the host or other polyfills                    |
| `BigInt`, `WeakRef`, `FinalizationRegistry`, `SharedArrayBuffer`, `Atomics` | Not polyfilled by this runtime; availability depends on the host or other polyfills                    |
| New regular-expression flags and named captures                             | The regular-expression engine is not polyfilled                                                        |

This is not a complete availability matrix for every ES2022 API. Other uninvestigated APIs and host-specific APIs remain unverified.

## Validation scope and evidence

The recorded host checks used After Effects 26.5x89 / ExtendScript 4.5.6 (build 80.1060872). Representative checks cover JSON, `Array.prototype.map`, `filter`, `reduce`, `Array.isArray`, `Object.keys`, `Function.prototype.bind`, `trim`, `Array.from`, `of`, `find`, `findIndex`, `startsWith`, `endsWith`, `Number.isFinite`, `Object.assign`, and `Math.trunc`. Later methods and JSON edge cases were checked in separate contracts.

Tested revisions and installation states differ. For 1.0.0, evidence combines AE/Illustrator/Photoshop initial installation, post-fix Premiere enumeration checks, and consumer behavior/performance results. See the [1.0.0 record](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/release-1.0.0.md) for version, feature and artifact boundaries. Older releases and macOS remain unverified; Node checks are distinct from Adobe host checks.

Implementation references: [`runtime-src/vendor/es5-shim.js`](https://github.com/YukiWorks432/extendscript-compat/blob/f68f5d6c77b10ef2c2a7a06d9a45db14c89cc894/runtime-src/vendor/es5-shim.js), [`es6-shim.js`](https://github.com/YukiWorks432/extendscript-compat/blob/f68f5d6c77b10ef2c2a7a06d9a45db14c89cc894/runtime-src/vendor/es6-shim.js), and [later method installation](https://github.com/YukiWorks432/extendscript-compat/blob/f68f5d6c77b10ef2c2a7a06d9a45db14c89cc894/runtime-src/install-polyfills.js).

Object.entries and Object.values reconstruct UTF-16 string indices when property descriptors are unavailable. This covers Premiere hosts where Object.keys omits string indices, while preserving additional enumerable properties on boxed strings.
