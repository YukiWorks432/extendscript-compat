import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "acorn";
import { rollup } from "rollup";
import terser from "@rollup/plugin-terser";
import { extendscriptCompat } from "../src/rollup.js";

const directory = resolve("tmp/bom-host-probe");
mkdirSync(directory, { recursive: true });
const files = {};
for (const compressed of [false, true]) {
  for (const bom of [true, false]) {
    const warnings = [];
    const bundle = await rollup({
      input: "test/contracts/bom-host-contract.js",
      plugins: [
        ...(compressed ? [terser({ format: { ascii_only: false, ecma: 5 } })] : []),
        extendscriptCompat({ bom }),
      ],
      onwarn(warning, defaultHandler) {
        if (warning.pluginCode === "MISSING_BOM") warnings.push(warning.pluginCode);
        else defaultHandler(warning);
      },
    });
    try {
      const result = await bundle.generate({
        format: "iife",
        name: "bomProbe",
        banner: "/*!" + "a".repeat(2200) + "*/",
        footer: "bomProbe.run();",
      });
      const chunk = result.output.find((file) => file.type === "chunk");
      if (!chunk) throw new Error("BOM probe produced no chunk");
      parse(chunk.code, { ecmaVersion: 3 });
      if (chunk.code.startsWith("\uFEFF") !== bom) throw new Error("Unexpected BOM state");
      if (warnings.length !== (bom ? 0 : 1)) throw new Error("Unexpected warning count");
      const prefix = chunk.code.slice(bom ? 1 : 0, (bom ? 1 : 0) + 2000);
      if (/[^\p{ASCII}]/u.test(prefix)) throw new Error("Probe prefix must be ASCII");
      const name = `bom-${compressed ? "minified" : "normal"}-${bom ? "on" : "off"}.jsx`;
      writeFileSync(resolve(directory, name), chunk.code, "utf8");
      files[name] = { sha256: createHash("sha256").update(chunk.code).digest("hex"), warnings };
    } finally {
      await bundle.close();
    }
  }
}
writeFileSync(resolve(directory, "manifest.json"), JSON.stringify(files, null, 2) + "\n");
console.log(JSON.stringify(files, null, 2));
