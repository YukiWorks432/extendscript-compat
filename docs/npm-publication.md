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

After initial registration, GitHub Actions and npm Trusted Publisher are recommended. Add a dedicated publication workflow in the future, and register its exact filename, GitHub owner, and repository with npm. Explicitly allow `npm publish` in the Trusted Publisher configuration if publishing directly with that command. OIDC removes the need to store a long-lived publishing token in the repository.

Use a GitHub-hosted runner, Node.js 24, and a compatible npm CLI with `contents: read` and `id-token: write`. Run validation and packaging for the specified commit before `npm publish`. The current CI workflow does not publish or request `id-token` permission.

Trusted Publisher requires npm CLI 11.5.1 or later and Node.js 22.14.0 or later. Its first publication must succeed within two days of configuration, so configure it only after publication is ready. For a public package published from a public repository using GitHub Actions Trusted Publisher, provenance is generated automatically. It is not generated for a private repository.

## Release criteria

Validate evaluated results, short-circuiting, side-effect order, existing parentheses, repeated application, minified output, source maps, and installation from the packed artifact. State the After Effects conditions and do not describe untested products such as Illustrator or Photoshop as host-verified.

Limit the first release to the uses actually tested. Treat corrections as patch changes, backward-compatible additions as minor changes, and input-condition or public-interface changes as the next minor release. Document changes during 0.x and do not republish an existing version.

## References

- [GitHub repository visibility and consequences](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)
- [Creating and publishing unscoped public packages](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/)
- [Trusted Publisher setup and limitations](https://docs.npmjs.com/trusted-publishers/)
- [Generating provenance statements](https://docs.npmjs.com/generating-provenance-statements/)
- [Inspecting package contents with pnpm](https://pnpm.io/cli/pack)
- [Checking authentication settings with pnpm](https://pnpm.io/cli/profile)

## Preparing 0.2.0

Version 0.2.0 includes runtime corrections EC-04, EC-05, EC-07, and EC-08; EC-03 automatic label insertion, notifications, and semicolon restoration; EC-06 regular-expression literal correction; and explicit `UnitValue` helpers for EC-10 and EC-11. The preparation PR updates the version, documentation, and implementation; it does not publish to npm, create a tag, or create a GitHub release.

After fixing the commit to publish, rerun `pnpm check`, compare hashes of the generated host-validation files, pack the package, and install it into an empty consumer. Include `runtime/index.js` and its declarations, `runtime/unit-value.js` and its declarations, runtime documentation, and third-party licenses. Do not reuse the initial seven-file count for 0.2.0; use the actual pack listing as the source of truth.

After publication, load all four public entries from the downloaded package: the root, Rollup, runtime, and unit-value entries. The runtime does not replace shared functions until explicitly imported; importing the unit-value entry alone does not modify host classes or functions.
