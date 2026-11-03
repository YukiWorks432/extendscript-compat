# 1.0.0 changes and release decision

English | [日本語（正本）](release-1.0.0.ja.md)

1.0.0 applies the [public contract](public-contract.md) as the compatibility baseline for 1.x. This preparation updates only the version and documentation, without changing compatibility code. npm publication is a separate manual action after merging the preparation PR.

## Changes since 0.4.0

The JSON.parse fallback rejects invalid JSON with SyntaxError and supports ES5 reviver traversal, replacement, deletion, and one-time input coercion. Inputs that depended on permissive parsing must be converted to valid JSON.

Object.entries and Object.values now reconstruct UTF-16 string indices when Premiere's Object.keys omits them, preserving extra boxed-string properties. Loading 0.4.0 before and after the corrected runtime was checked. Public entry points and Rollup options are unchanged; ES3 validation remains always enabled inside extendscriptCompat(). See the [runtime API matrix](../runtime/API-COMPATIBILITY.md) for limitations.

## Evidence used for release

The decision combines existing evidence through November 4, 2026 (Japan time), retaining each tested commit and artifact hash. Version/documentation-only preparation does not require repeating the same host operations or performance measurements. These are not all measurements of a single 1.0.0 artifact.

| Check                                                                                                    | Target              | Result                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Separate restarted engines for normal/minified initial installation, repeated loading, 0.4.0 coexistence | #44 merged, 9f180f4 | AE, Illustrator and Photoshop each 707/707; Premiere's three string-enumeration failures subsequently fixed in #45                           |
| Full contracts and repeated loading after the string fix                                                 | #45, e7326e8        | Premiere: four normal/minified and coexistence cases; Illustrator/Photoshop: both variants; AE: minified; each 714/714                       |
| Direct JSX execution by the user in Premiere                                                             | Same runtime as #45 | Four normal/minified and coexistence cases, each 714/714, repeated loading also passed                                                       |
| Public template                                                                                          | #44 merged          | All four scripts built; common checks 48/48 in all four hosts                                                                                |
| Real consumer versus published 0.4.0                                                                     | #44 merged          | All 88 scripts built, common checks 48/48 in four hosts on both versions; representative operations AE 10/10, Illustrator 7/7, Photoshop 4/4 |

Host versions: AE 26.5x89 / ExtendScript 4.5.6; Illustrator 30.8.2 / 4.5.6; Photoshop 27.11.0 for #44 and 27.9.0 for #45 / 4.5.12; Premiere Pro 26.5.2 / 4.5.6. This does not generalize to older releases or macOS, or extend the public guarantee to all Premiere functionality.

Premiere direct execution used /C es.processFile. The first normal case installed into the initial engine; the other three restored state within that engine. Object.keys was initially absent there, unlike the incomplete existing implementation on the BridgeTalk route. These are distinct starting conditions.

Original function values and inspected document state were preserved. An early harness omitted ES5/ES6 cache restoration; coexistence and consumer checks were repeated after correcting it. RegExp last-match state is excluded from API restoration checks. The first direct Premiere case retained ownership-metadata differences for global parseInt/parseFloat while restoring the original function values.

## Consumer build performance

Windows, Ryzen 7 9800X3D (8 cores/16 threads), Node.js 24.22.1, pnpm 12.6.0. Each version built all 88 scripts at concurrency four, with one warmup and five alternating measured runs. Dependency installation is excluded.

| Version         | Median  | Range         | Total output     |
| --------------- | ------- | ------------- | ---------------- |
| Published 0.4.0 | 46.17 s | 45.23–54.34 s | 10,312,588 bytes |
| #44 merged      | 48.18 s | 47.17–57.78 s | 10,358,249 bytes |

The difference is 2.01 s (+4.36%) and 45,661 bytes (+0.44%). These are not new post-#45 timings; runtime execution and JSON.parse performance were not measured.

The personal consumer still used 0.3.1 and older minifier settings. Both temporary copies added top-level Terser ie8: true and retained conditionals: false; original sources were unchanged. The public template passed with its existing settings. Representative operations intercepted display waits and do not cover dialog rendering/clicks. There is no Premiere-specific consumer script.

## Records and preparation checks

The [archived release evidence](https://github.com/YukiWorks432/extendscript-compat/blob/c313a4c5305f947bfcf996d5ff743858aa4c6487/docs/evidence/2026-11-04/v1-release/results.json) records tested commits, artifact hashes, contract counts, all twelve build runs and hashes for 88 outputs, excluding private source, script names and local absolute paths. See also the [post-fix host results](https://github.com/YukiWorks432/extendscript-compat/blob/c313a4c5305f947bfcf996d5ff743858aa4c6487/docs/evidence/2026-11-04/premiere-string-enumeration/results.json) and [direct-execution summary](https://github.com/YukiWorks432/extendscript-compat/blob/c313a4c5305f947bfcf996d5ff743858aa4c6487/docs/evidence/2026-11-04/v1-release/premiere-direct-execution.txt).

Original-record links are pinned to the archival commit. The current tree keeps the [validation index](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/evidence/README.ja.md) and this summary.

The #45 normal runtime SHA-256 is 4d7515dc41efa2a259d6861e924cd36c1e5bc5dda70739250703745dc1d59163; minified is c471417fac316d87beb69770d06f8c3c7786696ac066fa8748fedc3ab5fde499. Preparation compares implementation and declarations in src, runtime-src and runtime against #45 and checks formatting, automated validation and clean installation of the new package. Prior host evidence remains attributed to its actual tested revision.
