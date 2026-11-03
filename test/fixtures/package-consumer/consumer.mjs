import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";
import { rollup } from "rollup";
import terser from "@rollup/plugin-terser";

const originalNumber = Number;
const originalRound = Math.round;
const originalUnitValue = globalThis.UnitValue;
const { protectCompatibility } = await import("extendscript-compat");
const { extendscriptCompat } = await import("extendscript-compat/rollup");
const { toNumber } = await import("extendscript-compat/number");
const { subtractUnitValues, isNull } = await import("extendscript-compat/unit-value");
assert.equal(Number, originalNumber);
assert.equal(Math.round, originalRound);
assert.equal(globalThis.UnitValue, originalUnitValue);
assert.equal(toNumber("0b101"), 5);
assert.equal(subtractUnitValues(8, 3), 5);
assert.equal(isNull(null), true);
assert.equal(protectCompatibility("var result = a || b && c;").code, "var result = a || (b && c);");

const source = 'export var result = a || b && c; export var number = Number("0b101");';
for (const minified of [false, true]) {
  const bundle = await rollup({
    input: "consumer.js",
    plugins: [
      {
        name: "consumer-input",
        resolveId: (id) => (id === "consumer.js" ? id : null),
        load: (id) => (id === "consumer.js" ? source : null),
      },
      ...(minified ? [terser()] : []),
      extendscriptCompat(),
    ],
  });
  try {
    const { output } = await bundle.generate({
      format: "iife",
      name: "compiled",
      file: "consumer.jsx",
      sourcemap: true,
    });
    const chunk = output[0];
    assert.equal(chunk.type, "chunk");
    const result = runInNewContext(chunk.code + ";compiled", { a: false, b: true, c: 7 });
    assert.equal(result.result, 7);
    assert.equal(result.number, 5);
    assert(chunk.map.sources.some((name) => name.endsWith("consumer.js")));
    assert(chunk.map.sourcesContent.includes(source));
  } finally {
    await bundle.close();
  }
}

const invalidBundle = await rollup({
  input: "invalid.js",
  plugins: [
    {
      name: "invalid-consumer-input",
      resolveId: (id) => (id === "invalid.js" ? id : null),
      load: (id) => (id === "invalid.js" ? "globalThis.value = object.default;" : null),
    },
    extendscriptCompat({ diagnostics: "off" }),
  ],
});
try {
  await assert.rejects(invalidBundle.generate({ format: "iife" }), {
    code: "PLUGIN_ERROR",
    plugin: "extendscript-compat",
  });
} finally {
  await invalidBundle.close();
}

await import("extendscript-compat/runtime");
const require = createRequire(import.meta.url);
const root = dirname(require.resolve("extendscript-compat/package.json"));
for (const file of [
  "README.md",
  "README.ja.md",
  "LICENSE",
  "THIRD-PARTY-LICENSES.txt",
  "docs/build-compatibility.md",
  "docs/build-compatibility.ja.md",
  "docs/public-contract.md",
  "docs/public-contract.ja.md",
]) {
  assert(readFileSync(join(root, file), "utf8").trim().length > 0, `配布文書が空です: ${file}`);
}

const runtimeSource = readFileSync(require.resolve("extendscript-compat/runtime"), "utf8");
const jsonResult = runInNewContext(
  runtimeSource +
    `
(function () {
  var invalidRejected = false;
  try { JSON.parse("[1,]"); } catch (error) { invalidRejected = error instanceof SyntaxError; }
  return { invalidRejected: invalidRejected, value: JSON.parse('{"n":2}', function (key, value) { return key === "n" ? value + 1 : value; }).n };
}());`,
  { JSON: undefined },
);
assert.equal(jsonResult.invalidRejected, true);
assert.equal(jsonResult.value, 3);
