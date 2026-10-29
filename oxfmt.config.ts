import { defineConfig } from "oxfmt";

export default defineConfig({
  overrides: [
    {
      files: [
        "runtime/number.js",
        "test/contracts/number-host-contract.js",
        "test/contracts/number-auto-host-contract.js",
        "test/contracts/number-constructor-alias-host-contract.js",
        "test/contracts/bom-host-contract.js",
        "test/contracts/entries-flattening-string-at-contract.js",
        "test/contracts/array-at-has-own-contract.js",
      ],
      options: { trailingComma: "none" },
    },
  ],
  ignorePatterns: [
    "docs/evidence/**/*.jsx",
    "runtime-src/vendor/es5-shim.js",
    "runtime-src/vendor/es6-shim.js",
    "runtime-src/vendor/json2.js",
    "runtime/index.js",
    "test/fixtures/runtime-0.2.js",
    "test/fixtures/template-polyfills.ts",
  ],
});
