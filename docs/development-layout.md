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

docs/evidence/ contains a [validation index](evidence/README.ja.md). Summarize results in host-validation or release documents rather than adding full JSON dumps, generated JSX, or per-script hash inventories. Retain the date, tested revision/artifacts, environment, conditions, outcome, limitations and representative hashes needed for decisions.

Historical originals remain available through commit-pinned links in the index. Do not rewrite archived code or present historical checks as new runs of the current revision. Distinguish the archival commit from the tested commit. Host comparison data consumed by current tests lives under test/fixtures/regexp-host-results/ with its original contents preserved.

## Checks

Regenerate with node scripts/build-runtime.mjs, then run pnpm check for generated-file consistency, formatting, lint, types, and contracts. Host builders under scripts/build-host-*.mjs produce temporary output under tmp/. Moving files does not make historical host results validation evidence for newly generated output.

## Dependency updates and security audits

Dependabot opens npm and GitHub Actions update PRs every Monday at 10:20 JST. npm updates wait seven days after publication. Minor and patch updates are grouped separately for production and development dependencies; major updates remain separate PRs.

CI runs `pnpm audit --audit-level=high` before installing dependencies. It audits the entire lockfile, including development dependencies. High or critical findings and registry connection failures fail the check. The workflow does not automatically fix or suppress findings.

`dependency-audit.yml` runs the same audit daily at 09:48 JST and on manual dispatch. It uses a GitHub-hosted Ubuntu runner without installing project dependencies or building the package. Results are available in the Actions run history. When changing the pinned pnpm version, update this workflow's version as well.
