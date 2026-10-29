# Development file layout

[日本語（正本）](development-layout.ja.md) | English

## Sources and distribution

- src/: Build-time compatibility transformations and Rollup integration running in Node.js.
- runtime-src/vendor/: Adapted third-party code. See the runtime README and third-party notices for provenance and modifications.
- runtime-src/polyfills/: Array, String, and Object implementations and feature checks. Methods sharing an implementation stay together.
- runtime-src/polyfill-helpers.js: Shared number/length conversion and method installation.
- runtime-src/install-polyfills.js: Installation order and existing markers, retained for coexistence with older runtimes.
- runtime-src/builtin-corrections.js and trim.js: ExtendScript built-in corrections.
- runtime/index.js: Generated ES3, ASCII entry. Regenerate with scripts/build-runtime.mjs instead of editing it.
- runtime/number.js, unit-value.js, and declarations: Handwritten public APIs. The entire runtime/ directory is not generated.

Consumer imports are unchanged.

## Validation and historical records

test/runtime/ contains integration tests for later APIs; test/contracts/ contains executable checks shared by Node and AE; test/types/ contains declaration examples. test/fixtures/ holds inputs and older comparison implementations.

docs/evidence/ preserves historical validation records. Records from the three ES Next stages are grouped under 2026-10-29/ae-26.5/; other existing records retain their locations. Do not reformat archived execution code or rewrite it to use current paths. Absolute paths and target identifiers describe the original execution.

.jsx.txt stores executed code rather than a reusable execution entry. JSON sourceFile references a file in the same directory. For stage 3 records, sha256 hashes the UTF-8 execution string, matching the stored file after removing exactly one final LF. Distinguish this from output and contract file hashes.

## Checks

Regenerate with node scripts/build-runtime.mjs, then run pnpm check for generated-file consistency, formatting, lint, types, and contracts. Host builders under scripts/build-host-*.mjs produce temporary output under tmp/. Moving files does not make historical host results validation evidence for newly generated output.
