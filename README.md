# extendscript-compat

[日本語（正本）](README.ja.md) | English

A library for known Adobe ExtendScript bugs, with build-time corrections and explicit runtime APIs.

- Corrects expression precedence, `continue` across `switch` statements, and regular-expression hyphens at build time.
- Corrects `parseInt` and three string methods when the runtime is explicitly imported.
- Provides explicit helpers for `UnitValue` subtraction and `null` comparison.

## Installation

Node.js 22 or later is required. This README describes the upcoming 0.2.0 release. The published 0.1.0 release includes only expression-precedence protection and Rollup integration.

```sh
pnpm add -D extendscript-compat@0.1.0
```

To try 0.2.0 before publication, run `pnpm pack --pack-destination artifacts` at the target commit in this repository and add the resulting archive to the consuming project:

```sh
pnpm add -D ./path/to/extendscript-compat-0.2.0.tgz
```

Replace the path with the archive's location relative to the consuming project.

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

When needed, import the runtime after existing compatibility code and before initializing the application or its dependencies:

```js
import "extendscript-compat/runtime";
```

This entry replaces existing built-in functions and also affects other scripts in the same engine. `UnitValue` arithmetic and comparisons are not corrected automatically; use `subtractUnitValues` and `isNull` at the affected sites. See [runtime compatibility](runtime/README.md) for load order and limitations.

## Scope and documentation

Input must be code generated as ordinary JavaScript. Transpiling TypeScript to JavaScript and targeting ES3 syntax require separate build steps. Raw JSX containing E4X or unexpanded preprocessor directives is not supported.

Host checks were performed in After Effects 26.5x89 / ExtendScript 4.5.6. Other Adobe products, including Illustrator and Photoshop, have not been tested on a host.

- [Build-time corrections, diagnostics, and APIs](docs/build-compatibility.md)
- [Runtime corrections and UnitValue helpers](runtime/README.md)
- [0.2.0 host validation](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/compatibility-host-validation.md) and [built-in function host validation](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/runtime-host-validation.md)
- [npm publication procedure](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/npm-publication.md)

Japanese is the authoritative documentation; English is displayed first on GitHub and npm. If versions differ, the Japanese version takes precedence; update the corresponding English version in the same change. Type-declaration documentation places English first, followed by the authoritative Japanese text.

MIT License.
