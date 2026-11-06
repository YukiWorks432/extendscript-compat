import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { rollup } from "rollup";
import terser from "@rollup/plugin-terser";
import { extendscriptCompat } from "../src/rollup.js";

const names = [
  "polyfill",
  "runtime",
  "includes-padding-trimming",
  "entries-flattening-string-at",
  "array-at-has-own",
  "array-copy-search",
  "string-modern",
  "json-parse",
  "json-stringify",
  "ponyfill-boundaries",
];
const checks = names.map((name) => {
  let code = readFileSync(new URL(`../test/contracts/${name}-contract.js`, import.meta.url), "utf8")
    .trim()
    .replace(/;$/, "");
  // プロトタイプを一時変更する境界試験はNodeだけで行い、実機では実行しない。
  if (name === "array-copy-search")
    code = code.replace('if (typeof Object.defineProperty === "function") {', "if (false) {");
  return `${JSON.stringify(name)}: (\n${code}\n)`;
});
const source = `import "extendscript-compat/runtime"; export function run(){return {${checks.join(",\n")}};}`;
const directory = new URL("../tmp/ponyfill-host/", import.meta.url);
mkdirSync(directory, { recursive: true });
const manifest = [];
for (const compressed of [false, true]) {
  const bundle = await rollup({
    input: "ponyfill-probe",
    plugins: [
      {
        name: "probe-input",
        resolveId: (id) => (id === "ponyfill-probe" ? id : null),
        load: (id) => (id === "ponyfill-probe" ? source : null),
      },
      ...(compressed ? [terser({ ie8: true, format: { ascii_only: true, comments: /^!/ } })] : []),
      extendscriptCompat({ runtime: "ponyfill" }),
    ],
  });
  try {
    const chunk = (await bundle.generate({ format: "iife", name: "probe" })).output.find(
      (item) => item.type === "chunk",
    );
    if (!chunk) throw new Error("検証用チャンクがありません");
    const code = `(function(){
var targets=[$.global,Object,Object.prototype,Array,Array.prototype,String,String.prototype,Function,Function.prototype,Number,Number.prototype,Date,Date.prototype,Math];
function snapshot(){var result=[];for(var i=0;i<targets.length;i++){var keys=[],values=[];for(var k in targets[i]){if(Object.prototype.hasOwnProperty.call(targets[i],k)){keys.push(k);}}keys.sort();for(var j=0;j<keys.length;j++)values.push(targets[i][keys[j]]);result.push({keys:keys.join("|"),values:values});}return result;}
var before=snapshot(),parseRef=parseInt,charRef=String.prototype.charAt,splitRef=String.prototype.split,replaceRef=String.prototype.replace;
var initial={map:typeof Array.prototype.map,json:typeof JSON,bind:typeof Function.prototype.bind};
${chunk.code}
var reports=probe.run(),after=snapshot(),unchanged=parseRef===parseInt&&charRef===String.prototype.charAt&&splitRef===String.prototype.split&&replaceRef===String.prototype.replace;
for(var i=0;i<before.length;i++){if(before[i].keys!==after[i].keys)unchanged=false;for(var j=0;j<before[i].values.length;j++)if(before[i].values[j]!==after[i].values[j])unchanged=false;}
return {version:app.version,engine:$.version,initial:initial,unchanged:unchanged,reports:reports};
}());`;
    const name = compressed ? "minified.jsx" : "normal.jsx";
    writeFileSync(new URL(name, directory), code);
    manifest.push({ name, sha256: createHash("sha256").update(code).digest("hex") });
  } finally {
    await bundle.close();
  }
}
writeFileSync(new URL("manifest.json", directory), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
