import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { rollup } from "rollup";
import terser from "@rollup/plugin-terser";
import { extendscriptCompat } from "../src/rollup.js";

const runtimePath = fileURLToPath(
  new URL("../runtime-src/builtin-corrections.js", import.meta.url),
);
const bundle = await rollup({
  input: runtimePath,
  plugins: [terser({ format: { ascii_only: true, comments: /^!/ } }), extendscriptCompat()],
});
let code;
try {
  const generated = await bundle.generate({ format: "iife" });
  code = generated.output.find((item) => item.type === "chunk").code;
} finally {
  await bundle.close();
}
const contract = readFileSync(
  new URL("../test/contracts/runtime-contract.js", import.meta.url),
  "utf8",
)
  .trim()
  .replace(/;$/, "");
const runtimeSha256 = createHash("sha256").update(code).digest("hex");
const source = [
  "(function () {",
  "var root = $.global;",
  "var original = [root.parseInt, String.prototype.charAt, String.prototype.split, String.prototype.replace];",
  'var key = "__extendscriptCompatRuntime__";',
  "var hadCache = Object.prototype.hasOwnProperty.call(root, key);",
  "var oldCache = root[key];",
  'var beforeDefaults = [parseInt("010"), parseInt("08")].join(",");',
  "function check() { return " + contract + "; }",
  "var report = {hostVersion: app.version, engineVersion: $.version, engineBuild: $.build, runtimeSha256: " +
    JSON.stringify(runtimeSha256) +
    "};",
  "try {",
  "report.before = check();",
  "eval(" + JSON.stringify(code) + ");",
  "report.after = check();",
  "var installed = [root.parseInt, String.prototype.charAt, String.prototype.split, String.prototype.replace];",
  "eval(" + JSON.stringify(code) + ");",
  "report.repeated = check();",
  "report.idempotent = installed[0] === root.parseInt && installed[1] === String.prototype.charAt && installed[2] === String.prototype.split && installed[3] === String.prototype.replace;",
  'report.defaultsPreserved = beforeDefaults === [parseInt("010"), parseInt("08")].join(",");',
  "} finally {",
  "root.parseInt = original[0]; String.prototype.charAt = original[1]; String.prototype.split = original[2]; String.prototype.replace = original[3];",
  "if (hadCache) root[key] = oldCache; else delete root[key];",
  "}",
  "report.restored = root.parseInt === original[0] && String.prototype.charAt === original[1] && String.prototype.split === original[2] && String.prototype.replace === original[3];",
  "return report;",
  "}());",
  "",
]
  .join("\n")
  .trimEnd();
const directory = resolve("tmp/runtime-host-probe");
mkdirSync(directory, { recursive: true });
writeFileSync(resolve(directory, "runtime.jsx"), code);
writeFileSync(resolve(directory, "probe.jsx"), source);
const metadata = {
  runtimeSha256,
  probeSha256: createHash("sha256").update(source).digest("hex"),
  runtimePath: resolve(directory, "runtime.jsx"),
  probePath: resolve(directory, "probe.jsx"),
};
writeFileSync(resolve(directory, "manifest.json"), JSON.stringify(metadata, null, 2) + "\n");
console.log(JSON.stringify(metadata, null, 2));
