import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rollup } from "rollup";
import terser from "@rollup/plugin-terser";
import { parse } from "acorn";
import { extendscriptCompat } from "../src/rollup.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = resolve(root, "tmp/edge-case-host");
mkdirSync(directory, { recursive: true });
const previousCommit = "fdee7a92269e085f33b50613de3b3b8604cad0ba";
const previousPath = resolve(directory, "previous.jsx");
writeFileSync(
  previousPath,
  execFileSync("git", ["show", previousCommit + ":runtime/index.js"], { cwd: root }),
);
const rawPath = resolve(root, "runtime/index.js");
const minifiedPath = resolve(directory, "minified.jsx");
const ownContract = resolve(root, "test/contracts/array-at-has-own-contract.js");
const copyContract = resolve(root, "test/contracts/array-copy-search-contract.js");
const bundle = await rollup({
  input: rawPath,
  plugins: [terser({ format: { ascii_only: true, comments: /^!/ } }), extendscriptCompat()],
});
try {
  const { output } = await bundle.generate({ format: "iife" });
  if (output[0].type !== "chunk") throw new Error("生成チャンクがない");
  parse(output[0].code, { ecmaVersion: 3 });
  writeFileSync(minifiedPath, output[0].code);
} finally {
  await bundle.close();
}

// 対象の2段階だけを導入し、他の補完・JSON・プロジェクトには変更を加えない。
const probe = `(function () {
  var root = $.global;
  var markers = ["__extendscriptCompatPolyfills__", "__extendscriptCompatESNext1__", "__extendscriptCompatESNext2__", "__extendscriptCompatESNext3__", "__extendscriptCompatArrayCopy__", "__extendscriptCompatStringModern__", "__extendscriptCompatJSON__"];
  var names = ["at", "toSorted", "toReversed", "toSpliced", "findLast", "findLastIndex"];
  var saved = [], i, j, k;
  function capture(object, key) {
    saved.push({ object: object, key: key, owned: Object.prototype.hasOwnProperty.call(object, key), value: object[key] });
  }
  capture(Object, "hasOwn");
  capture(Array, "isArray");
  for (i = 0; i < names.length; i++) capture(Array.prototype, names[i]);
  for (i = 0; i < markers.length; i++) capture(root, markers[i]);
  var before = { items: app.project.numItems, dirty: app.project.dirty };
  var result = { appVersion: app.version, engineVersion: $.version, descriptors: typeof Object.defineProperty, symbols: typeof Symbol, cases: [] };
  var files = ${JSON.stringify([rawPath, minifiedPath])};
  try {
    // 旧ランタイム導入後の前提を、検証専用エンジンでも満たす。
    if (typeof Array.isArray !== "function") Array.isArray = function (value) { return Object.prototype.toString.call(value) === "[object Array]"; };
    for (i = 0; i < files.length; i++) {
      for (j = 0; j < 2; j++) {
        for (k = 0; k < markers.length; k++) root[markers[k]] = 1;
        delete root.__extendscriptCompatESNext3__;
        delete root.__extendscriptCompatArrayCopy__;
        delete Object.hasOwn;
        for (k = 0; k < names.length; k++) delete Array.prototype[names[k]];
        if (j) $.evalFile(new File(${JSON.stringify(previousPath)}));
        $.evalFile(new File(files[i]));
        var own = $.evalFile(new File(${JSON.stringify(ownContract)}));
        var copy = $.evalFile(new File(${JSON.stringify(copyContract)}));
        var refs = [Object.hasOwn];
        for (k = 0; k < names.length; k++) refs.push(Array.prototype[names[k]]);
        $.evalFile(new File(files[i]));
        $.evalFile(new File(${JSON.stringify(previousPath)}));
        $.evalFile(new File(files[i]));
        var retained = refs[0] === Object.hasOwn;
        for (k = 0; k < names.length; k++) if (refs[k + 1] !== Array.prototype[names[k]]) retained = false;
        result.cases.push({ variant: i ? "minified" : "raw", previousRuntime: !!j, own: own, copy: copy, repeatedAndOldAfterIdentity: retained });
      }
    }
  } finally {
    for (i = saved.length - 1; i >= 0; i--) {
      if (saved[i].owned) saved[i].object[saved[i].key] = saved[i].value;
      else delete saved[i].object[saved[i].key];
    }
  }
  result.projectUnchanged = before.items === app.project.numItems && before.dirty === app.project.dirty;
  result.restored = true;
  for (i = 0; i < saved.length; i++) {
    if (saved[i].object[saved[i].key] !== saved[i].value || Object.prototype.hasOwnProperty.call(saved[i].object, saved[i].key) !== saved[i].owned) result.restored = false;
  }
  return result;
}());`;
parse(probe, { ecmaVersion: 3 });
writeFileSync(resolve(directory, "probe.jsx"), probe);
const manifest = { previousCommit };
for (const [name, file] of Object.entries({
  raw: rawPath,
  minified: minifiedPath,
  previous: previousPath,
  ownContract,
  copyContract,
})) {
  manifest[name + "Sha256"] = createHash("sha256").update(readFileSync(file)).digest("hex");
}
writeFileSync(resolve(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
