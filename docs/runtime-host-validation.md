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

The following command regenerates the same output and probe. Compare the generated hashes with the records above.

```sh
node scripts/build-host-runtime-probe.mjs
```

File execution is governed by the MCP configuration. The file input for this run was rejected due to the worktree path restriction, so the file contents were read and the same code was executed inline. Since MCP trims surrounding whitespace from strings, the generator also removes the final newline to match the hash of the executed code. The permission configuration was not changed.

This validates actual output generated from the implementation and shared test fixture; it is separate from Node mock-environment results. Other Adobe products and older versions were not tested on a host, and no existing template was modified. Regular-expression engine hangs and capture loss, and `UnitValue`, were outside this validation.
