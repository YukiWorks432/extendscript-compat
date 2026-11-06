import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: [
    "plans/evidence/**",
    "runtime-src/vendor/es5-shim.js",
    "runtime-src/vendor/es6-shim.js",
    "runtime-src/vendor/json2.js",
    "runtime/index.js",
    "runtime/ponyfill.js",
    "test/fixtures/template-polyfills.ts",
    "test/fixtures/json2-legacy.js",
  ],
});
