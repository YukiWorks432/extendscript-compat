# Public contract for v1

[日本語（正本）](public-contract.ja.md) | English

This document records the accepted compatibility contract for 1.x. It does not announce a 1.0.0 release or completion of outstanding host validation. The linked usage documents and shipped type declarations define the detailed behavior.

## Public entries and types

| Entry                            | Guaranteed role                                                                                                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extendscript-compat`            | `protectPrecedence`, `findPrecedenceIssues`, `assertPrecedenceProtected`, `protectCompatibility`, `findCompatibilityIssues`, `protectUnicode`, `findRegExpRisks`, and their result, diagnostic, and edit-position types |
| `extendscript-compat/rollup`     | `extendscriptCompat(options)` and `CompatibilityOptions`: Number transforms, output corrections, BOM, and ES3 syntax validation                                                                                         |
| `extendscript-compat/runtime`    | Explicit side-effect import of built-in polyfills and corrections, with corresponding additional type declarations                                                                                                      |
| `extendscript-compat/number`     | `toNumber` without replacing the host Number                                                                                                                                                                            |
| `extendscript-compat/unit-value` | `subtractUnitValues`, `isNull`, and `UnitValueLike`                                                                                                                                                                     |

Access to distribution metadata through `extendscript-compat/package.json` is retained. Internal file layout, parser ASTs and parser-specific exception fields, and installation-marker names and values are not public contracts. Use the entries above instead of importing internal files.

## Build-time contract

Input is code generated as ordinary JavaScript. Consumers transpile TypeScript and target ES3 separately. Raw JSX with E4X or unexpanded preprocessor directives is unsupported. Unparseable input throws rather than succeeding without corrections.

Corrections preserve the evaluated results, short-circuiting, side-effect order, and bindings described in [build compatibility](build-compatibility.md). Observable representation changes, such as regular-expression `source`, follow the documented limitations. Direct correction APIs do not add ES3 syntax validation.

The Rollup plugin transforms module-local Number references after TypeScript or other source transforms, then corrects output after minification and include expansion. ES3 validation always runs after compatibility corrections and BOM insertion and stops the build on invalid syntax, including with `diagnostics: "off"`. There is no separate public validation API or disable option.

| Option              | Default  | Contract                                                                                                                                           |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diagnostics`       | `"warn"` | Reports EC-03 and unsupported Number references; `"error"` stops the build and `"off"` suppresses these notifications                              |
| `regexpDiagnostics` | `"off"`  | Independently reports potential EC-18/19 risks; it does not fix them or prove regex safety                                                         |
| `bom`               | `true`   | Places one BOM at the start of each JavaScript chunk; the `MISSING_BOM` warning for non-ASCII output when disabled is independent of `diagnostics` |

The guaranteed output is the code at the end of this plugin's `generateBundle` processing. Later plugins mutating code in the same hook, or subsequent minification, are outside those corrections and checks. Place JSXBin conversion after this step.

With valid preceding source maps, external, inline, and hidden maps are updated for corrections. Information lost by earlier transforms cannot be restored.

Public diagnostic fields, the meanings of `code` and `kind`, position conventions, and warning/error conditions are maintained. Direct APIs reference the original input: lines are 1-based, columns and offsets use 0-based UTF-16 code units. Rollup Number diagnostics reference modules; compatibility and regex diagnostics reference output before corrections; ES3 errors reference corrected output. Exact explanatory messages and parser-specific exception shapes are not guaranteed.

## Runtime contract

Rollup's `runtime: "ponyfill"` rewrites the standard API references specified in [build-time compatibility](build-compatibility.md#ponyfill-mode) to bundle-local implementations without modifying the host. It suppresses `/runtime` imports in that bundle while preserving the installation contract when the option is omitted. The linked document defines dynamic-reference and external-code limitations.

Explicitly import `/runtime` before application and dependency initialization. It affects other scripts in the same engine but does not change previously saved function references. The root and `/rollup` entries do not install the runtime automatically; merely importing `/number` or `/unit-value` does not replace host classes or functions.

Reloading the same version does not repeatedly wrap functions. Existing polyfilled APIs that pass the supported checks are retained; the four known-broken functions are replaced as described in [runtime compatibility](../runtime/README.md). Later overwrites by other libraries are not automatically undone. Coexistence with older releases is verified only under the conditions recorded in host evidence.

The JSON fallback follows the JSON grammar and rejects invalid input with `SyntaxError`. It supports ES5 `reviver` traversal from children to parents, replacement and deletion, and one-time input string coercion. Grammar validation does not replace application checks of data shape or value ranges. Later additions such as the third `reviver` argument are outside the guaranteed scope.

The [runtime API matrix](../runtime/API-COMPATIBILITY.md) defines individual polyfills and host-dependent limitations. Complete ES5/ES2015+ emulation, Symbol, Promise, replacement of the regular-expression engine, and automatic repair of ordinary UnitValue operators are not guaranteed.

## Environments and release validation

Build tools target Node.js 22 or later and Rollup 4. CI checks Ubuntu and Windows with Node.js 22 and 24. The host-validation baseline is After Effects 26.5x89 / ExtendScript 4.5.6 on Windows. Illustrator, Photoshop and Premiere checks are limited to the versions, features and installation states in the [1.0.0 evidence](release-1.0.0.md). Unverified features, older releases and macOS must not be described as host-verified.

The 1.0.0 release decision combines separate normal/minified first installations into unmodified engines, repeated loading, older-version coexistence, consumer output/operations/build timings, and subsequent checks of corrected areas. Record tested commits and artifact hashes and retain evidence for unchanged areas. Version/documentation-only updates do not trigger blanket host or performance reruns. Behavior changes or newly discovered defects require additional checks of affected areas. Individual tests or Node simulations alone do not complete host validation; contract acceptance remains distinct from actual release evidence.

## Changes after v1

Follow [SemVer](https://semver.org/) against the guarantees in this document and its references.

- Patch: backward-compatible corrections that restore guaranteed behavior.
- Minor: backward-compatible features or APIs, and deprecation notices.
- Major: rejection of guaranteed inputs, API removal, or default changes that break previously valid usage.

Never overwrite a published version. Describe input-condition or environment changes and required migrations in both release-note languages. During 0.x, follow the [npm publication procedure](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/npm-publication.md).
