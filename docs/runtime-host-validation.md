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

The test project had no items but became dirty after the minified check, so it was saved temporarily; the cause was not established. Other Adobe products were not tested. The [investigation and validation record](evidence/esnext-stage1-ae-26.5.json) includes the executed code and hashes.
