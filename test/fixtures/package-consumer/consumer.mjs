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
const { assertES3Syntax, protectCompatibility } = await import("extendscript-compat");
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

assert.throws(() => assertES3Syntax("value.default;"), SyntaxError);

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
    assertES3Syntax(chunk.code);
    const result = runInNewContext(chunk.code + ";compiled", { a: false, b: true, c: 7 });
    assert.equal(result.result, 7);
    assert.equal(result.number, 5);
    assert(chunk.map.sources.some((name) => name.endsWith("consumer.js")));
    assert(chunk.map.sourcesContent.includes(source));
  } finally {
    await bundle.close();
  }
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
]) {
  assert(readFileSync(join(root, file), "utf8").trim().length > 0, `配布文書が空です: ${file}`);
}
