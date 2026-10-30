import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rollup } from "rollup";
import terser from "@rollup/plugin-terser";
import { parse } from "acorn";
import { extendscriptCompat } from "../src/rollup.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = resolve(root, "tmp/json-host");
mkdirSync(directory, { recursive: true });
const rawPath = resolve(root, "runtime/index.js");
const minifiedPath = resolve(directory, "minified.jsx");
const contractPath = resolve(root, "test/contracts/json-stringify-contract.js");
const legacyPath = resolve(root, "test/fixtures/json2-legacy.js");
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

// JSON以外の導入は省略し、検証で変更するグローバル値をfinallyで復元する。
const probe = `(function () {
  var root = $.global;
  var markers = ["__extendscriptCompatPolyfills__", "__extendscriptCompatESNext1__", "__extendscriptCompatESNext2__", "__extendscriptCompatESNext3__", "__extendscriptCompatArrayCopy__", "__extendscriptCompatStringModern__", "__extendscriptCompatJSON__"];
  var targets = [root, Date.prototype, Boolean.prototype, Number.prototype, String.prototype];
  var names = ["JSON", "toJSON", "toJSON", "toJSON", "toJSON"];
  var saved = [], i, j;
  function capture(object, key) {
    saved.push({ object: object, key: key, owned: Object.prototype.hasOwnProperty.call(object, key), value: object[key] });
  }
  for (i = 0; i < targets.length; i++) capture(targets[i], names[i]);
  for (i = 0; i < markers.length; i++) capture(root, markers[i]);
  var before = { items: app.project.numItems, dirty: app.project.dirty };
  var result = { appVersion: app.version, engineVersion: $.version, cases: [] };
  var files = ${JSON.stringify([rawPath, minifiedPath])};
  try {
    for (i = 0; i < files.length; i++) {
      for (j = 0; j < 2; j++) {
        root.JSON = {};
        for (var k = 0; k < markers.length; k++) root[markers[k]] = 1;
        delete root.__extendscriptCompatJSON__;
        if (j) $.evalFile(new File(${JSON.stringify(legacyPath)}));
        var oldParse = root.JSON.parse;
        $.evalFile(new File(files[i]));
        var checks = $.evalFile(new File(${JSON.stringify(contractPath)}));
        var stringify = root.JSON.stringify;
        $.evalFile(new File(files[i]));
        var repeated = stringify === root.JSON.stringify;
        $.evalFile(new File(${JSON.stringify(legacyPath)}));
        result.cases.push({ variant: i ? "minified" : "raw", previousJSON: j ? "legacy" : "missing", total: checks.total, failures: checks.failures, repeatedIdentity: repeated, legacyAfterIdentity: stringify === root.JSON.stringify, parsePreserved: !j || oldParse === root.JSON.parse });
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
const manifest = {};
for (const [name, file] of Object.entries({
  raw: rawPath,
  minified: minifiedPath,
  contract: contractPath,
  legacy: legacyPath,
})) {
  manifest[name + "Sha256"] = createHash("sha256").update(readFileSync(file)).digest("hex");
}
writeFileSync(resolve(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
