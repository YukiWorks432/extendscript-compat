# extendscript-compat

[日本語（正本）](README.ja.md) | English

A library providing build-time bug corrections and runtime compatibility for Adobe ExtendScript.

- Corrects expression precedence, `continue` across `switch` statements, and regular-expression hyphens at build time.
- Provides JSON, selected ES5 and ES6 polyfills, and corrections for `parseInt` and three string methods when explicitly imported.
- Provides explicit helpers for `UnitValue` subtraction and `null` comparison.

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

Import the runtime before initializing the application or its dependencies. It applies JSON, ES5, and ES6 polyfills followed by the four function corrections:

```js
import "extendscript-compat/runtime";
```

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
