import { defineConfig } from "oxfmt";

export default defineConfig({
  ignorePatterns: [
    "runtime-src/es5-shim.js",
    "runtime-src/es6-shim.js",
    "runtime-src/json2.js",
    "runtime/index.js",
    "test/fixtures/runtime-0.2.js",
    "test/fixtures/template-polyfills.ts",
  ],
});
