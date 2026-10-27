import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "acorn";
import { rollup } from "rollup";
import terser from "@rollup/plugin-terser";
import { extendscriptCompat } from "../src/rollup.js";

const directory = resolve("tmp/number-extended-host-probe");
mkdirSync(directory, { recursive: true });
const hashes = {};
for (const compressed of [false, true]) {
  const bundle = await rollup({
    input: "test/fixtures/number-constructor-alias-host-contract.js",
    plugins: [
      ...(compressed ? [terser({ format: { ascii_only: true, ecma: 5 } })] : []),
      extendscriptCompat(),
    ],
    onwarn(warning, defaultHandler) {
      if (warning.pluginCode !== "NUMBER_UNSUPPORTED") defaultHandler(warning);
    },
  });
  try {
    const result = await bundle.generate({
      format: "iife",
      name: "numberAutoProbe",
      footer: "numberAutoProbe.run();",
    });
    const chunk = result.output.find((file) => file.type === "chunk");
    if (!chunk) throw new Error("Number extended probe produced no chunk");
    parse(chunk.code, { ecmaVersion: 3 });
    const name = compressed ? "number-extended-minified.jsx" : "number-extended-normal.jsx";
    writeFileSync(resolve(directory, name), chunk.code, "utf8");
    hashes[name] = createHash("sha256").update(chunk.code).digest("hex");
  } finally {
    await bundle.close();
  }
}
writeFileSync(resolve(directory, "manifest.json"), JSON.stringify(hashes, null, 2) + "\n");
console.log(JSON.stringify(hashes, null, 2));
