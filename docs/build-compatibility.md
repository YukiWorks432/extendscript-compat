# Build-time compatibility

[日本語（正本）](build-compatibility.ja.md) | English

## Usage

Node.js 22 or later is required. The library uses Babel for parsing. `protectPrecedence` inserts parentheses into the original source rather than regenerating the entire file.

```js
import { protectPrecedence, assertPrecedenceProtected } from "extendscript-compat";

const result = protectPrecedence("var value = a || b && c; var other = a ? b : c ? d : e;");
// var value = a || (b && c); var other = a ? b : (c ? d : e);
assertPrecedenceProtected(result.code);
```

`protectPrecedence` returns the corrected `code` and `insertions`, the positions of the individual inserted parentheses in the original input. Reapplying it to the same code does not keep adding parentheses.

`findPrecedenceIssues` returns the kind, character positions, line and column for unprotected expressions. Lines are one-based; columns and character positions are zero-based. The public diagnostic data does not expose Babel AST types.

## Rollup integration

Add the plugin to a Rollup 4 host build after minification, include expansion, and the addition of compatibility code, but before conversion to JSXBin. A later generator or minifier that removes parentheses can undo the protection.

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

The plugin corrects and checks each output chunk and updates an existing valid source map for inserted parentheses and semicolons and replaced regular-expression text. External, inline, and hidden source maps are supported. It cannot recover mapping information lost when an earlier plugin changed code without updating the map. Handle CEP-specific include expansion in the consuming build.

## Scope

`protectPrecedence` continues to insert only parentheses. `protectCompatibility` and the Rollup `extendscriptCompat` plugin also handle EC-03 and EC-06 below.

The input must be code already generated as ordinary JavaScript. Leave TypeScript and ES3 syntax conversion to an existing build step such as Babel. Raw JSX containing ExtendScript-specific E4X or unexpanded preprocessor directives is not supported. A parse failure throws rather than silently returning unmodified code.

The protection adds parentheses at boundaries between mixed `&&` and `||` operators and around ternary expressions directly nested in the condition, true branch, or false branch of another ternary. It preserves values, short-circuiting, and bindings visible to `this`, `arguments`, and `eval` without introducing functions or temporary variables. Check JSON implementations, character encoding, Adobe product APIs, and similar requirements in the consuming project.

The expression protection was checked in After Effects 26.5x89 / ExtendScript 4.5.6 with 22 language regressions and 96 consuming-product regressions. It has not been tested in other Adobe products such as Illustrator or Photoshop.

## EC-03 and EC-06 build-time corrections and diagnostics

Rollup's `extendscriptCompat()` also does the following:

- EC-03: Corrects an unlabeled `continue` that crosses a `switch` to reach an outer loop. It reuses the target loop's existing label or adds a collision-free label, sharing one label for each loop. A `continue` targeting an inner loop is unchanged. It also restores a trailing semicolon on labeled `continue` statements when a minifier has removed it.
- EC-06: In regular-expression literals using only the ES3 `g`, `i`, and `m` flags, replaces `\x2D` and `\u002D` with `\-` inside character classes. Lowercase hexadecimal digits are also supported. Strings passed to a dynamic `RegExp` constructor and escapes outside character classes are unchanged.

EC-03 is corrected automatically with a warning by default. Select `error` to stop a build even when the issue can be corrected, for example to enforce a policy that source code contains no EC-03 issue. Select `off` to correct without a notification.

```js
extendscriptCompat({ diagnostics: "error" });
// "warn": warning (default), "error": stop the build, "off": suppress notifications
```

For direct integration into a build tool, use the combined API:

```js
import { findCompatibilityIssues, protectCompatibility } from "extendscript-compat";

const result = protectCompatibility(source);
// result.code: precedence, EC-06, continue labels, and semicolons corrected
// result.edits: insertions and replacements against the original input (start / end / text)
// result.diagnostics: notifications for automatically corrected EC-03 issues in the original input
const issues = findCompatibilityIssues(source);
```

`findCompatibilityIssues` reports EC-03 and EC-06 in the original input. `protectCompatibility` returns notifications for original EC-03 issues in `diagnostics`; these do not mean the corrected output still contains an unresolved bug. Each diagnostic has `code`, `kind`, `start`, `end`, `line`, `column`, and `message`. Lines are one-based; columns and character positions are zero-based UTF-16 code-unit offsets. Edits and diagnostics refer to the original input. A regular expression's `source` or `toString()` reflects the rewritten syntax, while the matched character set is preserved.

## Related implementations

Other tools address some of the same bugs. The following were checked on 2026-10-26:

- [babel-preset-extendscript](https://github.com/fusepilot/babel-preset-extendscript) parenthesizes nested ternaries as a Babel preset and includes many other transformations and compatibility features.
- [UglifyJS](https://github.com/mishoo/UglifyJS#output-options) protects nested ternaries with `output.extendscript: true`. Version 3.19.3 on npm did not add parentheses to `a || b && c` in the check.
- [extendscript-minimizer](https://github.com/gmeeker/extendscript-minimizer/blob/master/transforms/transform.precedence.js) uses Closure Compiler and jscodeshift to protect both bugs with explicit parentheses. The npm package of the same name could not be obtained during the investigation.

extendscript-compat combines insertion into generated code, diagnostic and assertion APIs, and Rollup source-map updates. It is intended to run near the end of a build alongside existing transformations and minifiers.

## Development

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm pack --pack-destination artifacts
```

The tests cover boolean combinations, side-effect order and count, existing parentheses, repeated application, minified output, and source maps. Host coverage and generated-output evidence are recorded with the PR validation results.

MIT License.
