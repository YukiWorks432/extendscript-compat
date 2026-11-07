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
var targetNames=["global","Object","Object.prototype","Array","Array.prototype","String","String.prototype","Function","Function.prototype","Number","Number.prototype","Date","Date.prototype","Math"];
function snapshot(){var result=[];for(var i=0;i<targets.length;i++){var keys=[],values=[];for(var k in targets[i]){if(Object.prototype.hasOwnProperty.call(targets[i],k)){keys.push(k);}}keys.sort();for(var j=0;j<keys.length;j++)values.push(targets[i][keys[j]]);result.push({keys:keys.join("|"),values:values});}return result;}
var before=snapshot(),parseRef=parseInt,charRef=String.prototype.charAt,splitRef=String.prototype.split,replaceRef=String.prototype.replace;
var initial={map:typeof Array.prototype.map,json:typeof JSON,bind:typeof Function.prototype.bind,stringPrototypeThis:Object.prototype.hasOwnProperty.call(String.prototype,"this")};
${chunk.code}
var reports=probe.run(),after=snapshot(),unchanged=parseRef===parseInt&&charRef===String.prototype.charAt&&splitRef===String.prototype.split&&replaceRef===String.prototype.replace;
var differences=[];
for(var i=0;i<before.length;i++){
 var oldKeys=before[i].keys?before[i].keys.split("|"):[],newKeys=after[i].keys?after[i].keys.split("|"):[];
 for(var side=0;side<2;side++){
  var keys=side?newKeys:oldKeys,other=side?oldKeys:newKeys;
  for(var j=0;j<keys.length;j++){
   var match=-1;for(var k=0;k<other.length;k++)if(keys[j]===other[k]){match=k;break;}
   if(match<0)differences.push({target:targetNames[i],key:keys[j],kind:side?"added":"removed"});
   else if(!side){var a=before[i].values[j],b=after[i].values[match];if(a!==b&&!(a!==a&&b!==b))differences.push({target:targetNames[i],key:keys[j],kind:"changed",beforeType:typeof a,afterType:typeof b});}
  }
 }
}
var refs=[parseRef===parseInt,charRef===String.prototype.charAt,splitRef===String.prototype.split,replaceRef===String.prototype.replace],refNames=["parseInt","String.prototype.charAt","String.prototype.split","String.prototype.replace"];
for(var i=0;i<refs.length;i++)if(!refs[i])differences.push({target:refNames[i],kind:"reference"});
unchanged=differences.length===0;
return {version:app.version,engine:$.version,initial:initial,unchanged:unchanged,differences:differences,reports:reports};
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
