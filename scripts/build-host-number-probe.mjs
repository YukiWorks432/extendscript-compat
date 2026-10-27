import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { rollup } from "rollup";
import terser from "@rollup/plugin-terser";
import { extendscriptCompat } from "../src/rollup.js";

const directory = resolve("tmp/number-host-probe");
mkdirSync(directory, { recursive: true });
const hashes = {};
for (const compressed of [false, true]) {
  const bundle = await rollup({
    input: "test/fixtures/number-host-contract.js",
    plugins: [
      ...(compressed ? [terser({ format: { ascii_only: true, ecma: 5 } })] : []),
      extendscriptCompat(),
    ],
  });
  try {
    const result = await bundle.generate({
      format: "iife",
      name: "numberProbe",
      footer: "numberProbe.run();",
    });
    const chunk = result.output.find((file) => file.type === "chunk");
    if (!chunk) throw new Error("Number probe produced no chunk");
    const name = compressed ? "number-minified.jsx" : "number-normal.jsx";
    writeFileSync(resolve(directory, name), chunk.code, "utf8");
    hashes[name] = createHash("sha256").update(chunk.code).digest("hex");
  } finally {
    await bundle.close();
  }
}
writeFileSync(resolve(directory, "manifest.json"), JSON.stringify(hashes, null, 2) + "\n");
console.log(JSON.stringify(hashes, null, 2));
