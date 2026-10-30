# extendscript-compat

[日本語（正本）](README.ja.md) | English

A library providing build-time bug corrections and runtime compatibility for Adobe ExtendScript.

- Corrects expression precedence, `continue` across `switch` statements, and regular-expression hyphens at build time.
- Provides JSON, selected ES5, ES6, and later polyfills, and corrections for `parseInt` and three string methods when explicitly imported.
- Provides explicit helpers for `UnitValue` subtraction and `null` comparison.

In this example, an expression that returns `true` in ordinary JavaScript returns `false` in After Effects ExtendScript. Adding parentheses to the generated code preserves the intended evaluation order.

![With isAdmin true and isOwner and isReady false, AE returns false without correction and true with correction](https://raw.githubusercontent.com/YukiWorks432/extendscript-compat/main/docs/images/readme/logical-precedence.en.png)

<details>
<summary>Code used in the comparison</summary>

<!-- prettier-ignore -->
```js
var isAdmin = true;
var isOwner = false;
var isReady = false;

// Before correction: false in AE.
var enabled = isAdmin || isOwner && isReady;

// Generated code after correction: true in AE.
var enabled = isAdmin || (isOwner && isReady);
```

</details>

## Installation

Node.js 22 or later is required.

```sh
pnpm add -D extendscript-compat
```

## Rollup integration

In a Rollup 4 host build, place the plugin after minification, include expansion, and the addition of compatibility code, but before conversion to JSXBin:

```js
import { extendscriptCompat } from "extendscript-compat/rollup";

export default {
  input: "src/index.js",
  output: { file: "dist/script.jsx", format: "iife", sourcemap: true },
  plugins: [
    // Babel, Terser, include expansion, etc.
    extendscriptCompat(),
    // JSXBin conversion if needed
  ],
};
```

A later generator or minifier that removes parentheses can undo the precedence protection. See [build-time compatibility](docs/build-compatibility.md) for direct APIs and correction conditions.

## Runtime corrections

Import the runtime before initializing the application or its dependencies. It applies JSON, selected ES5, ES6, and later polyfills, as well as the four function corrections. Bundle the following application code with Rollup or a similar tool before running it:

```js
import "extendscript-compat/runtime";

parseInt("a?", 16); // 10
```

For example, `parseInt("a?", 16)` returns `175` in uncorrected After Effects. After importing the runtime, it stops at the invalid `?` character and returns `10`.

![The same parseInt("a?", 16) call returns 175 in AE before the runtime import and the expected 10 afterward](https://raw.githubusercontent.com/YukiWorks432/extendscript-compat/main/docs/images/readme/parse-int.en.png)

This entry adds and replaces built-in functions and also affects other scripts in the same engine. `UnitValue` arithmetic and comparisons are not corrected automatically; use `subtractUnitValues` and `isNull` at the affected sites. See [runtime compatibility](runtime/README.md) for load order and limitations.

## Scope and documentation

Input must be code generated as ordinary JavaScript. Transpiling TypeScript to JavaScript and targeting ES3 syntax require separate build steps. Raw JSX containing E4X or unexpanded preprocessor directives is not supported.

Host checks were performed in After Effects 26.5x89 / ExtendScript 4.5.6. Other Adobe products, including Illustrator and Photoshop, have not been tested on a host.

- [Build-time corrections, diagnostics, and APIs](docs/build-compatibility.md)
- [Runtime corrections and UnitValue helpers](runtime/README.md)
- [additional compatibility host validation](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/compatibility-host-validation.md) and [built-in function host validation](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/runtime-host-validation.md)
- [npm publication procedure](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/npm-publication.md)

Japanese is the authoritative documentation; English is displayed first on GitHub and npm. If versions differ, the Japanese version takes precedence; update the corresponding English version in the same change. Type-declaration documentation places English first, followed by the authoritative Japanese text.

MIT License.
