# npm publication procedure

[日本語（正本）](npm-publication.ja.md) | English

The initial 0.1.0 release, providing expression-precedence protection and Rollup 4 integration, was published publicly on npm on 2026-10-26. The GitHub repository was private at the time; the npm package included the JavaScript under `src`, type declarations, README, and MIT license.

On 2026-10-27, the repository was also made public after its history, PRs, and Actions logs were reviewed. It is operated as a public MIT-licensed repository so users can inspect the implementation, tests, and reasons for changes and submit bug reports or fixes. GitHub visibility and publication of an npm version are separate operations.

## Checks before making the GitHub repository public

Before changing visibility, inspect not only current files but also commits reachable from remote branches, tags, and PRs; PR descriptions, comments, and reviews; and all Actions attempts, logs, check annotations, and saved artifacts. Past code and Actions history and logs become visible on publication. Stop and address any credentials, personal paths, customer data, or similar information found.

On 2026-10-27, the following were checked against base commit `fa198c95fa7b3542100bf2cdc3d49b235c1bd6e4`:

| Area        | Scope                                                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Git history | 14 commits, 88 distinct file contents, and author/commit metadata obtained from all remote branches, tags, and PR #1–#4 refs |
| PRs         | Descriptions, diffs, and commit information for #1–#4. There were no issue comments, inline comments, or submitted reviews.  |
| Actions     | 13 runs and all 13 attempts, 52 jobs, 148 log files, and 41 check annotations                                                |
| Other       | No issues, releases, saved artifacts, or push rulesets that would be disabled by the visibility change                       |

Gitleaks 8.30.1 with its default rules found no credentials in the publication scope: all Git history (`--all --full-history`), public-facing PR and related API data, and all extracted logs. Author information, absolute paths, external references, and host evidence were also reviewed in context. Author email addresses were public noreply addresses, and absolute paths in logs belonged to GitHub-hosted runners. References to related consuming projects did not contain their source code or configuration. No credentials, personal paths, or customer data that would prevent publication were found.

These counts describe the state before the policy update. Including the policy PR and subsequent additions, 15 commits, 5 PRs, and 14 Actions runs with 56 jobs and 200 log files were checked immediately before publication. After publication, the unauthenticated GitHub API reported `visibility=public` and `private=false`, and README and PR retrieval succeeded. The final results, including the additional check after merging, are recorded in [PR #5](https://github.com/YukiWorks432/extendscript-compat/pull/5). Raw logs and temporary credentials specific to authenticated API responses are not copied into documentation or packages.

## Initial npm publication record and procedure

Before the initial publication on 2026-10-26, an npm lookup for extendscript-compat returned 404. That did not reserve the name; it had to be checked again immediately before publication. If already taken, registration was to stop and a change to the owner's npm scope was to be considered, updating consuming dependencies and examples at the same time.

### Initial publication sequence

1. Complete library and consumer validation and independent review, then fix the commit to publish.
2. Confirm that the GitHub repository is public according to policy, and check the npm owner, package name, and MIT license. The public npm package includes JavaScript under `src` and type declarations. Publishing with provenance requires a public repository and a supported CI environment.
3. In the initial release-preparation PR, remove `private` and set `publishConfig.access` to `public` and `publishConfig.registry` to `https://registry.npmjs.org/`. Review and merge the changes, then revalidate and repack from that commit. Do not use a development tarball that contained `private`.
4. For initial registration, the owner signs in to npm and publishes the verified tarball with two-factor authentication. After registration, install it in a separate empty directory and recheck the root and Rollup entries.
5. Replace the consuming adobe-cep project's bundled tarball with the npm dependency and submit an integration PR for the public template, then propose integration into Bolt-CEP.

Initial registration is performed on the owner's machine with two-factor authentication enabled, only after publication is authorized and the tarball has been rebuilt from the fixed commit.

The following commands document the initial 0.1.0 publication, which has already taken place. pnpm 12.15.0 can check connectivity, account information, and packaging. For the initial publication, sign in with npm CLI from this library directory and publish the verified tarball with that same CLI. After signing in, compare the owner reported by both `npm whoami` and `pnpm whoami`.

```sh
npm login
npm whoami
pnpm whoami
pnpm ping
npm profile get tfa --json
pnpm view extendscript-compat name version
pnpm install --frozen-lockfile
pnpm check
pnpm pack --pack-destination artifacts
npm publish ./artifacts/extendscript-compat-0.1.0.tgz --access public --registry=https://registry.npmjs.org/
pnpm view extendscript-compat@0.1.0 version dist.integrity
```

Immediately before publication, compare the fixed commit, tarball SHA-256, absence of `private`, and the seven files for the initial release. After publication, compare the registry's `dist.integrity` with the downloaded tarball, and install it in an empty consumer to check the public API and Rollup integration. If the connection drops after a registration may have been accepted, check the registry first instead of republishing the same version.

A 404 name lookup does not guarantee that the name can be obtained at publication time. Inspect the package with `pnpm pack --dry-run --json`. For the initial release, `files` was restricted to `src`, `README.md`, and `LICENSE`, but npm also includes files such as `package.json` automatically. The intended npm package is public and does not require a registration fee.

## Ongoing publication

Manually run `Publish to npm` in [`publish.yml`](../.github/workflows/publish.yml). Merging into main does not publish a package. The workflow does not update versions, create Git tags, or create GitHub Releases. It publishes stable versions to npm's `latest` tag and rejects prereleases.

### Initial npm configuration

When a release is ready, add a Trusted Publisher in the npm settings for `extendscript-compat`.

| Setting              | Value                                                  |
| -------------------- | ------------------------------------------------------ |
| Provider             | GitHub Actions                                         |
| Organization or user | `YukiWorks432`                                         |
| Repository           | `extendscript-compat`                                  |
| Workflow filename    | `publish.yml` (without a directory)                    |
| Environment name     | Leave empty; this workflow does not use an environment |
| Allowed actions      | Allow direct publication with `npm publish`            |

OIDC authentication does not require `NPM_TOKEN`, `NODE_AUTH_TOKEN`, or `npm login`. Only the publication job receives `id-token: write`; validation uses only `contents: read`. Publication runs on GitHub-hosted Ubuntu with Node.js 24 and npm 11.19.1.

Trusted Publisher requires npm CLI 11.5.1 or later and Node.js 22.14.0 or later. The first publication must succeed within two days of configuration; delete and recreate an expired configuration. Saving the configuration or running `npm publish --dry-run` does not validate OIDC authentication; the first real publication does. Provenance is generated automatically for this public package and repository. See [npm's configuration and limitations](https://docs.npmjs.com/trusted-publishers/).

### Each publication

1. Review and merge a PR updating `package.json` to the appropriate version. Published versions cannot be overwritten.
2. In GitHub Actions, open `Publish to npm` and select `Run workflow`. Select `main` and enter the intended `version`. For example, `0.3.2` requires main's `package.json` to also contain `0.3.2`.
3. Check the commit SHA captured when the run starts. Validation, packaging, and publication use that SHA even if main advances during the run.
4. After success, check the version, commit SHA, and SHA-512 integrity in the run summary, and inspect the provenance on npm.

Preflight requires the input to match the package version, the version to be unpublished, and a stable version newer than the current `latest`. The workflow then reuses CI on Ubuntu and Windows with Node.js 22 and 24. Each of the four environments audits dependencies, runs `pnpm check`, packs the package, and installs it into an empty consumer. Consumer checks cover all five public entries, normal and minified Rollup output and source maps, types, documentation, and licenses.

After all environments pass, the publication job packs the same SHA and checks its tarball in an empty consumer, then passes that exact `.tgz` to `npm publish`. It rechecks registry state before publication and compares npm's `latest`, `dist.integrity`, and the downloaded tarball's SHA-512 afterward. Concurrent runs are serialized without cancelling an active publication.

After npm accepts publication, registry lookups may take a few minutes to reflect it. Post-publication verification uses a five-minute waiting deadline and repeats lookups every ten seconds only while the version or `latest` is missing. A mismatched registered hash or downloaded tarball, HTTP errors, and other failures stop verification immediately.

### Validation without publication and recovery

To validate the packed artifact locally, run the following at the repository root. `check:package` uses npm to install into a temporary empty directory and removes that directory afterward.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm pack --pack-destination artifacts
npm run check:package
```

If CI or packaging fails, merge the fix into main and start a new manual run. If the publication command or a later step fails, registration may already have succeeded. First inspect `npm view extendscript-compat@<version> version dist.integrity` and `npm view extendscript-compat dist-tags`. Compare the downloaded tarball with the SHA-512 in the run log and do not republish an existing version. Retry after fixing the cause only if the version is absent; if a published artifact is incorrect, prepare a corrected new version.

If the log says npm accepted publication, wait for propagation even when the version is not yet found; do not publish it again. Once available, run `node scripts/npm-release.mjs verify <tarball>` with a tarball whose SHA-512 matches the run log to repeat verification without publishing.

A failed registry lookup stops publication and is never treated as an absent version. Rerunning with an existing version also stops before publication. This workflow does not run After Effects or other Adobe hosts; satisfy the release criteria separately as appropriate for the change.

## Release criteria

Validate evaluated results, short-circuiting, side-effect order, existing parentheses, repeated application, minified output, source maps, and installation from the packed artifact. State the After Effects conditions and do not describe untested products such as Illustrator or Photoshop as host-verified.

Limit the first release to the uses actually tested. Treat corrections as patch changes, backward-compatible additions as minor changes, and input-condition or public-interface changes as the next minor release. Document changes during 0.x and do not republish an existing version.

For 1.x, follow the accepted [public contract for v1](public-contract.md) for entries, inputs, diagnostics, runtime side effects, and versioning. That document also defines final-candidate first-install and consumer checks before 1.0.0. Accepting the contract does not complete those release checks.

## References

- [GitHub repository visibility and consequences](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)
- [Creating and publishing unscoped public packages](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/)
- [Trusted Publisher setup and limitations](https://docs.npmjs.com/trusted-publishers/)
- [Generating provenance statements](https://docs.npmjs.com/generating-provenance-statements/)
- [Inspecting package contents with pnpm](https://pnpm.io/cli/pack)
- [Checking authentication settings with pnpm](https://pnpm.io/cli/profile)

## Checks before and after publication

After fixing the commit to publish, run `pnpm check`, compare hashes of the generated host-validation files, pack the package, and install it into an empty consumer. Include the public entries and type declarations, English and Japanese usage documentation, and third-party licenses. Compare the package listing with `package.json`.

After publication, load all five public entries from the downloaded package: the root, Rollup, runtime, number, and unit-value entries. The runtime does not replace shared functions until explicitly imported; importing the number or unit-value entry alone does not modify host classes or functions.
