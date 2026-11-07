import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { minify } from "terser";
import { protectCompatibility } from "../src/index.js";
import assert from "node:assert/strict";
import { createContext, runInContext } from "node:vm";
const runtime = readFileSync(new URL("../runtime/index.js", import.meta.url), "utf8");
const contract = readFileSync(
  new URL("../test/contracts/object-descriptors-contract.js", import.meta.url),
  "utf8",
)
  .trim()
  .replace(/;$/, "");
const directory = new URL("../tmp/object-host/", import.meta.url);
mkdirSync(directory, { recursive: true });
const manifest = [];
for (const compressed of [false, true]) {
  // 結果を返す外枠は圧縮せず、配布するランタイムだけを圧縮する。
  const implementation = compressed
    ? (await minify(runtime, { ie8: true, format: { ascii_only: true } })).code
    : runtime;
  const source = `(function(){var initial=[typeof Object.create,typeof Object.defineProperty,typeof Object.getOwnPropertyDescriptor];var limitedObjectDescriptors=true;${implementation}\nvar refs=[Object.create,Object.defineProperty,Object.getOwnPropertyDescriptor];var report=${contract};${implementation}\nreturn {version:app.version,engine:$.version,initial:initial,after:[typeof Object.create,typeof Object.defineProperty,typeof Object.getOwnPropertyDescriptor],stable:refs[0]===Object.create&&refs[1]===Object.defineProperty&&refs[2]===Object.getOwnPropertyDescriptor,report:report};}());`;
  const code = "\uFEFF" + protectCompatibility(source).code;
  const context = createContext({});
  runInContext(
    'var $={global:this,version:"Node VM"};var app={version:"Node VM"};delete Object.create;delete Object.defineProperty;delete Object.getOwnPropertyDescriptor;',
    context,
  );
  const result = runInContext(code, context);
  assert(result && typeof result === "object" && result.report, "検証結果が圧縮で失われました");
  assert.equal(result.report.failures.length, 0);
  assert.equal(result.report.passed, result.report.total);
  assert.equal(result.stable, true);
  const name = compressed ? "polyfill-minified.jsx" : "polyfill-normal.jsx";
  writeFileSync(new URL(name, directory), code);
  manifest.push({ name, sha256: createHash("sha256").update(code).digest("hex") });
}
writeFileSync(new URL("manifest.json", directory), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest));
