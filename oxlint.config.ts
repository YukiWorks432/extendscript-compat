import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: [
    "docs/evidence/**/*.jsx",
    "plans/evidence/**",
    "runtime-src/vendor/es5-shim.js",
    "runtime-src/vendor/es6-shim.js",
    "runtime-src/vendor/json2.js",
    "runtime/index.js",
    "test/fixtures/template-polyfills.ts",
  ],
});
