# Host validation of additional compatibility corrections in 0.2.0

[日本語（正本）](compatibility-host-validation.ja.md) | English

On 2026-10-26, correction methods for EC-03, EC-06, EC-10, and EC-11 were investigated and the final output was validated in After Effects 26.5x89 / ExtendScript 4.5.6 (build 80.1060872) on Windows.

## Investigation and selected approaches

The [investigation code](evidence/compatibility-investigation.jsx) and [result](evidence/compatibility-investigation-ae-26.5.json) record the SHA-256 hashes of the input and executed body.

| Issue | Difference observed on the host                                                                                                                                                                                                                         | Selected approach                                                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| EC-03 | An unlabeled `continue` inside a `switch` reached the following statement. Specifying the target loop's label correctly advanced to the next iteration. Omitting the semicolon at the end of a labeled `continue` caused a syntax error, `Expected: ;`. | Identify the target loop; add a collision-free label or reuse an existing label. Restore semicolons omitted from labeled `continue` by minification.                           |
| EC-06 | A hexadecimal hyphen inside a character class was treated as a range. Explicitly escaping it worked correctly.                                                                                                                                          | Locally rewrite literals using ES3 `g`, `i`, and `m` flags; leave escapes outside character classes, strings, and dynamic constructors unchanged.                              |
| EC-10 | Number 10 minus 2 in produced -8 in. Direct operator overrides worked in some cases, but not after the original operator had been obtained. Prototype changes did not correct new instances either.                                                     | Use `subtractUnitValues` explicitly for number-minus-`UnitValue`, preserving the native type, unit, and `baseUnit`. Delegate other number/`UnitValue` subtraction to the host. |
| EC-11 | Strict comparison of a 0.5 in `UnitValue` with `null` returned `true`. Distinguishing `UnitValue` first worked correctly.                                                                                                                               | Use `isNull` explicitly without changing the class or existing operators.                                                                                                      |

These observations rule out rewriting every subtraction or comparison of unknown types and replacing the shared `UnitValue` constructor. Ordinary operators are not guaranteed to be corrected automatically.

## Final-output validation

Rollup generated non-minified and Terser-minified versions from the 0.2.0 implementation and shared test fixtures; `extendscriptCompat` was applied after each output was generated. Each version was installed independently after restoring the original four functions, and reloading the same version was also checked.

| Output                  | First run                        | Reload                           |
| ----------------------- | -------------------------------- | -------------------------------- |
| Non-minified, corrected | Additional 53/53, existing 71/71 | Additional 53/53, existing 71/71 |
| Minified, corrected     | Additional 53/53, existing 71/71 | Additional 53/53, existing 71/71 |

Additional checks cover `finally` with labeled `continue`, negated character classes, range endpoints and escapes, subtraction direction, type and unit, px and % conversion bases, signed zero, input immutability, invalid inputs, and distinguishing `null` from `UnitValue`. Host-specific operators are executed separately in AE; Node mocks are not treated as proof of host behavior.

Fresh application and reapplication identity of the four functions, restoration afterward, and preservation of the `UnitValue` constructor and project state were also checked. The results and generated-file hashes are in the [host evidence](evidence/compatibility-auto-label-ae-26.5.json). No project items were added or changed, and the project was not saved.

Automatic label insertion includes 17 scenarios: `for`, `while`, `do-while` and `for-in`, multiple `continue` statements for one loop, nesting, reuse of existing labels, collision avoidance with outer or later labels, comments and ASI, loops without braces, `finally`, and bindings for `this`, `arguments`, and direct `eval`. Standard Node behavior was compared with fixed expected values; the same inputs were included in actual non-minified and minified output and checked in AE.

The [previous host evidence](evidence/compatibility-ae-26.5.json) retains the additional 36/36 and existing 71/71 results for head `41b38aab03ef1d93d2cf7ccf31aaecda0c1576ae`, before automatic label insertion.

## Reproduction

```sh
pnpm check
node scripts/build-host-compatibility-probe.mjs
```

The output directory is `tmp/compatibility-host-probe`. `manifest.json` records the SHA-256 hashes of the two actual outputs, `probe.jsx`, and `probe-body.jsx`, the body passed to `eval.run`. Passing `probe-body.jsx` to the AE connection's `eval.run` restores the original functions and shared-engine marker in `finally`. Compare the returned failure list, installation and restoration status, and generated-file hashes with the evidence.

During the investigation the standard MCP route timed out. Cancellation was requested for those calls, and the investigation and final validation were performed using `eval.run` on another responsive AE connection. Timeouts were not counted as successful host tests. Connection settings and the project were not changed.

The confirmed scope is the AE environment above. Other Adobe products and older versions, E4X, host execution after JSXBin conversion, and integration into existing consuming projects have not been verified. Regular-expression engine capture loss and hangs are outside these corrections.

## References

- [ExtendScript operator overloading](https://extendscript.docsforadobe.dev/extendscript-tools-features/operator-overloading/)
- [UnitValue arithmetic and base units](https://extendscript.docsforadobe.dev/extendscript-tools-features/specifying-measurement-values/)
- [IdExtenso UnitValue investigation](https://github.com/indiscripts/IdExtenso/blob/0c2f70f4afa25aff691ebdc72575103965a66aee/etc/%24%24.Unit.jsxlib#L166)
- [First-hand report for EC-03](https://community.adobe.com/questions-628/bug-extendscript-incorrectly-handles-the-continue-statement-within-switch-statements-685465)
