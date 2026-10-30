# AE host validation of built-in function corrections

[日本語（正本）](runtime-host-validation.ja.md) | English

Checked on 2026-10-26 in After Effects 26.5x89 / ExtendScript 4.5.6 (build 80.1060872) on Windows.

| Stage                                                         | Passed / cases |
| ------------------------------------------------------------- | -------------- |
| Original built-in functions                                   | 38 / 71        |
| After applying the minified, precedence-protected corrections | 71 / 71        |
| After reapplying the same corrections in the same engine      | 71 / 71        |

The check also verified the identity of the four functions across reapplication, preservation of omitted-radix behavior, and restoration of the four functions afterward. No project items were added or changed, and the project was not saved. The probe restores the original functions and shared-engine marker in `finally`.

- MCP request ID: `req-18e1fa77c7c8f698-10184-7`
- Minified runtime correction SHA-256: `9235c8d4bfaa334ea381f822756a0c89ae58a40fa1e7cb46cd41345c2da77af3`
- Probe SHA-256: `14168611b037421252c9fce4ce9b5da4f1b03f067fda87651e0c59a20524b21e`
- [Execution result](evidence/runtime-ae-26.5.json)

The following command generates a probe for the four corrections from 0.2.0. It does not include the JSON, ES5, or ES6 polyfills.

```sh
node scripts/build-host-runtime-probe.mjs
```

File execution is governed by the MCP configuration. The file input for this run was rejected due to the worktree path restriction, so the file contents were read and the same code was executed inline. Since MCP trims surrounding whitespace from strings, the generator also removes the final newline to match the hash of the executed code. The permission configuration was not changed.

This validates actual output generated from the implementation and shared test fixture; it is separate from Node mock-environment results. Other Adobe products and older versions were not tested on a host, and no existing template was modified. Regular-expression engine hangs and capture loss, and `UnitValue`, were outside this validation.

## JSON, ES5, and ES6 polyfill validation

On 2026-10-27, the integrated runtime was checked in After Effects 26.5x89 / ExtendScript 4.5.6 (build 80.1060872). Both the unminified and minified outputs passed 22 polyfill checks and 71 checks for the existing four corrections. Repeated loading passed the 22 polyfill checks and preserved function identities. All 48 tests from the source template passed. In a temporary template copy, `init` was changed to the single `/runtime` import; type checking and all four script builds succeeded. The actual test build, with only the result display replaced for automation, also passed all 48 checks on the host.

The first run found that an existing `JSON.parse` ignored its reviver, failing one of 22 checks; `JSON.stringify` also ignored its replacer. A feature check was added to replace these incomplete JSON functions.

The corrected unminified and minified outputs were first checked in the same shared engine after the first polyfill installation. The integration marker was cleared, but ES5/ES6 caches and installed functions remained. After restarting After Effects, the unminified output was installed with all four markers and caches absent; all 22 polyfill checks, 71 correction checks, and the repeated-load check passed. A fresh-engine first installation of the minified output was not checked. The project item count and dirty state did not change during each check.

The [validation record](evidence/polyfills-ae-26.5.json) contains the results and generated hashes. Run `node scripts/build-host-polyfill-probe.mjs` to regenerate the minified output and template test.

## Additional trim, Unicode, and Number.parseInt validation

On the same AE and ExtendScript versions, all four markers and caches, `trim`, and `Number.parseInt` were absent immediately after a restart. The current unminified output was first loaded with `$.evalFile`. Before loading, `parseInt("a?", 16)` returned 175; afterward, `Number.parseInt("a?", 16)` returned 10.

The first run passed 107 of 109 checks. The other two involved string conversion through `Number()`: assignment to the global `Number` did not take effect in AE. For example, `Number("0b101")` returned NaN and `Number()` with a leading U+200B returned 0. These are host limitations distinct from `Number.parseInt`.

With those two checks separated from the shared contract, subsequent tests of both the unminified and minified outputs passed 107 / 107 polyfill cases and 71 / 71 existing correction cases. Repeated loading passed all 107 cases and preserved function identities. The source template passed 48 / 48 cases. The minified output and final shared fixture were checked in the shared engine after the unminified installation. The unminified executable has the same hash as the one first loaded.

A separate ASCII-only probe loaded through `$.evalFile` preserved U+200C, U+200D, and U+FEFF in a string and correctly matched and rejected inputs for a regular expression containing U+200C. The project had six items and was dirty before and after testing. The [host evidence](evidence/trim-unicode-ae-26.5.json) records versions, hashes, and the two initial discrepancies. Other Adobe products and older versions were not tested.

## Validation of selected ES Next methods

On 2026-10-29, a dedicated After Effects 26.5x89 / ExtendScript 4.5.6 (build 80.1060872) process was checked. The seven target methods and `Object.defineProperty` were absent before installation, and properties assigned to prototypes were enumerable.

After loading the 0.3.0 runtime, the unminified runtime passed 102 checks for the added methods and preserved function identity on re-evaluation. Loading the old version after the new version was also checked. Working existing methods were retained, and replacement of incomplete methods passed all 102 checks. The minified output was executed after removing the target methods and the new installation marker in the test process; it passed 102 new checks, 107 existing polyfill checks, 71 checks for the four corrections, and re-evaluation. First installation into a fresh AE engine was not checked in this run.

The test project had no items but became dirty after the minified check, so it was saved temporarily; the cause was not established. Other Adobe products were not tested. The [investigation and validation record](evidence/2026-10-29/ae-26.5/esnext-stage1/esnext-stage1-ae-26.5.json) includes the executed code and hashes.

## Validation of second-stage ES Next methods

On 2026-10-29, a dedicated After Effects 26.5x89 / ExtendScript 4.5.6 (build 80.1060872) process was checked. The five methods were absent, and `Object.keys` returned integer keys in insertion order. String indices appeared in `Object.keys` but did not always report own or enumerable attributes. Omitted positions in `[1,,3]` existed as own properties, while holes created with `delete` did not.

After the first-stage runtime was applied, the five methods and second-stage marker were removed in the test engine before running the raw and minified outputs. Both passed 46 second-stage and 102 first-stage checks, re-evaluation, and function-identity checks. The minified output also passed 107 existing polyfill and 71 correction checks. Retention of working methods, replacement of incomplete methods, and loading the earlier runtime afterward were checked. First installation into a fresh AE engine and other Adobe products were not tested.

The test project contained six items; its states before and after testing were saved separately. The cause of its dirty state after the minified check was not established. The [investigation and validation record](evidence/2026-10-29/ae-26.5/esnext-stage2/esnext-stage2-ae-26.5.json) includes the executed code and hashes.

## ES Next stage 3 host validation

On October 29, 2026, a dedicated After Effects 26.5x89 / ExtendScript 4.5.6 (build 80.1060872) process was tested. Neither method was available initially. The existing ownership check sometimes failed to recognize string indices and certain built-in array, string, and function properties.

With the earlier runtime already installed, the two methods and the stage marker were removed before testing both raw and minified builds. Both passed 36 stage 3, 46 stage 2, and 102 stage 1 cases and preserved function identity on re-evaluation. The minified build also passed 107 existing polyfill and 71 correction cases. Preservation of working methods, replacement of broken methods, and loading the previous runtime after the new runtime were checked. The test project contained no items but became dirty during revalidation, so it was saved temporarily. The cause was not established. Initial installation of the final build in a fresh engine and other Adobe products were not tested. The [results and executed code](evidence/2026-10-29/ae-26.5/esnext-stage3/esnext-stage3-ae-26.5.json) include the corresponding hashes.

## Array copying and reverse search host validation

This section records host validation of commit d6a1752, which included with. The current implementation provides the remaining five methods. Saved code and hashes are historical; the build after removing with has not been rerun in AE.

On October 29, 2026, a dedicated After Effects 26.5x89 / ExtendScript 4.5.6 process was tested. None of the six methods existed; dot access to with failed because it is a reserved word. Raw and minified builds each passed 49 cases, including function identity on re-evaluation. The minified build also passed the existing 36, 46, 102, 107, and 71-case contracts. Preservation of working methods, replacement of broken methods, and loading the older runtime after the new one were checked. The six methods were absent before initial raw installation; the minified build was checked after removing the methods and their marker.

The test project contained no items and was clean in all recorded results. Other Adobe products and older AE versions were not tested. See [executed code, results, and hashes](evidence/2026-10-29/ae-26.5/array-copy-search/results.json).

## Full replacement and well-formed UTF-16 host validation

On 2026-10-29, a dedicated After Effects 26.5x89 / ExtendScript 4.5.6 (build 80.1060872) process was investigated. All three target methods were absent. String-search replace skipped callbacks, a global empty match omitted its terminal replacement, and flags was absent while global was usable. UTF-16 surrogates were retained as individual code units.

Further investigation of the initial implementation showed that AE replace did not reset lastIndex and callbacks observed the previous value. A reset after replacement-value coercion and regression cases were added. For the final builds, the three methods and their marker were removed from an engine that already had the earlier runtime installed, then the raw and minified outputs were loaded. Both passed 56 new cases; re-evaluating the raw output preserved function identities. The minified output also passed 184 stage 1–3 cases, 107 earlier polyfill cases, and 71 correction cases. Retention of working methods, replacement of incomplete methods, and loading the previous main runtime before and after the new runtime also passed.

The test project had no items. It became dirty during verification and was saved temporarily before shutdown. This environment has an extension that records project-open time and can mark a project dirty without manual edits. First installation of the final build in a fresh engine, older AE versions, and other Adobe products were not tested. Symbol delegation was checked in Node; AE exercised the path without Symbol. The [results and executed code](evidence/2026-10-29/ae-26.5/string-modern/results.json) separately record hashes for generated artifacts, the shared contract, execution requests, and saved files.

## Verification of split at a final boundary

On October 30, 2026, the minified and precedence-protected output for the four corrected functions was verified in After Effects 26.5x89 / ExtendScript 4.5.6 (build 80.1060872). All 73 shared contract cases passed both after installation and after reapplication. Function identity and restoration of the original functions were also verified. Before installation, 39 of 73 cases passed. The project was unmodified and contained no items before the test.

- Request ID: `req-18e335111dd8fc0c-45372-2`
- Minified correction SHA-256: `6b4e452da9360f838419628f3b7688c9392cd36c75f296595052edd27234b25d`
- Probe SHA-256: `a4e2e0484124ef25654b868368eba46b7b7db8da7a71316432e9ea3533bfb6e6`

Other Adobe products and older versions were not verified.

## Nested JSON.stringify calls and array replacers

On October 30, 2026, the raw and minified, precedence-protected runtime passed all 15 shared JSON contract cases in After Effects 26.5x89 / ExtendScript 4.5.6. Each build was checked with JSON absent and with the legacy json2 plus the earlier runtime installation marker present. Cases covered nested replacers and indentation, number and boxed keys, property order, deduplication, and a key list captured before recursion. Re-evaluation and loading legacy json2 afterward preserved function identity; existing parse functions were retained.

Non-JSON installations were skipped using their markers. JSON, markers, and toJSON properties were restored afterward, and the project item count and dirty state were unchanged. First installation of all runtime features in a fresh engine, older AE versions, and other Adobe products were not checked. See the [results and artifact hashes](evidence/2026-10-30/ae-26.5/json-stringify/results.json). Run `node scripts/build-host-json-probe.mjs` to regenerate the probe and hashes.

## Edge cases in ownership checks and copying arrays

On October 30, 2026, the raw and minified builds were checked in After Effects 26.5x89 / ExtendScript 4.5.6, both without the target methods and after the previous runtime. All four conditions passed 38 ownership cases and 39 array-copy cases, preserving function identities after re-evaluation and loading the previous build afterward. Other installation stages were skipped using their markers; the Array.isArray prerequisite was supplied temporarily. Modified functions and markers were restored, and project item count and dirty state were unchanged.

This AE has neither Symbol nor Object.defineProperty, so Symbol-key and inherited-descriptor regressions were checked in Node. The native toSorted in Node 24.22.1 was also observed to honor inherited numeric properties on its one-element path and was replaced by the behavior check. First installation of all features in a fresh engine, older AE versions, and other Adobe products were not checked. See the [results and artifact hashes](evidence/2026-10-30/ae-26.5/compatibility-edge-cases/results.json). Run `node scripts/build-host-edge-case-probe.mjs` to regenerate the probe and hashes.
