import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rollup } from "rollup";
import terser from "@rollup/plugin-terser";
import { extendscriptCompat } from "../src/rollup.js";
import { findCompatibilityIssues } from "../src/index.js";

const root = fileURLToPath(new URL("../", import.meta.url));
let contract = readFileSync(
  new URL("../test/fixtures/compatibility-contract.js", import.meta.url),
  "utf8",
)
  .trim()
  .replace(/;$/, "");
const continueCases = JSON.parse(
  readFileSync(new URL("../test/fixtures/continue-cases.json", import.meta.url), "utf8"),
);
const continueChecks = continueCases
  .map(
    ({ name, code, expected }) =>
      "check(" +
      JSON.stringify("EC-03: " + name) +
      ",function(){return " +
      code +
      ";}," +
      JSON.stringify(expected) +
      ");",
  )
  .join("\n");
const returnReport =
  "  return { total: total, passed: total - failures.length, failures: failures };";
if (!contract.includes(returnReport)) throw new Error("Missing host contract result");
contract = contract.replace(returnReport, continueChecks + "\n" + returnReport);

const runtimeContract = readFileSync(
  new URL("../test/fixtures/runtime-contract.js", import.meta.url),
  "utf8",
)
  .trim()
  .replace(/;$/, "");
const entry =
  'import "extendscript-compat/runtime";\n' +
  'import {subtractUnitValues,isNull} from "extendscript-compat/unit-value";\n' +
  "export function run(){return {additional:" +
  contract +
  "(subtractUnitValues,isNull),runtime:" +
  runtimeContract +
  "};}\n";
const outputs = [];
for (const minified of [false, true]) {
  const bundle = await rollup({
    input: "compatibility-probe",
    plugins: [
      {
        name: "probe-input",
        resolveId(id) {
          if (id === "compatibility-probe") return id;
          if (id === "extendscript-compat/runtime") return resolve(root, "runtime/index.js");
          if (id === "extendscript-compat/unit-value")
            return resolve(root, "runtime/unit-value.js");
        },
        load(id) {
          if (id === "compatibility-probe") return entry;
        },
      },
      ...(minified ? [terser({ format: { ascii_only: true, comments: /^!/ } })] : []),
      extendscriptCompat({ diagnostics: "off" }),
    ],
  });
  try {
    const generated = await bundle.generate({ format: "iife", name: "compatibilityValidation" });
    const code = generated.output.find((item) => item.type === "chunk").code;
    const sha256 = createHash("sha256").update(code).digest("hex");
    outputs.push({ variant: minified ? "minified" : "protected", code, sha256 });
  } finally {
    await bundle.close();
  }
}
const probe = [
  "(function(){",
  "var root=$.global;",
  "var original=[root.parseInt,String.prototype.charAt,String.prototype.split,String.prototype.replace];",
  'var key="__extendscriptCompatRuntime__";',
  "var hadCache=Object.prototype.hasOwnProperty.call(root,key); var oldCache=root[key];",
  "var nativeUnitValue=root.UnitValue;",
  "var beforeItems=app.project.numItems;var beforeDirty=app.project.dirty;",
  "var report={hostVersion:app.version,engineVersion:$.version,engineBuild:$.build,variants:[]};",
  "try{",
  ...outputs.flatMap(({ variant, code, sha256 }) => [
    "root.parseInt=original[0];String.prototype.charAt=original[1];String.prototype.split=original[2];String.prototype.replace=original[3];delete root[key];",
    "eval(" + JSON.stringify(code) + ");",
    "var installed=[root.parseInt,String.prototype.charAt,String.prototype.split,String.prototype.replace];",
    "var result={variant:" +
      JSON.stringify(variant) +
      ",sha256:" +
      JSON.stringify(sha256) +
      ",first:compatibilityValidation.run()};",
    "eval(" + JSON.stringify(code) + ");",
    "result.repeated=compatibilityValidation.run();",
    "result.installed=installed[0]!==original[0] && installed[1]!==original[1] && installed[2]!==original[2] && installed[3]!==original[3];",
    "result.idempotent=installed[0]===root.parseInt && installed[1]===String.prototype.charAt && installed[2]===String.prototype.split && installed[3]===String.prototype.replace;",
    "report.variants.push(result);",
  ]),
  "}finally{",
  "root.parseInt=original[0];String.prototype.charAt=original[1];String.prototype.split=original[2];String.prototype.replace=original[3];",
  "if(hadCache)root[key]=oldCache;else delete root[key];",
  "}",
  "report.restored=root.parseInt===original[0] && String.prototype.charAt===original[1] && String.prototype.split===original[2] && String.prototype.replace===original[3];",
  "report.unitConstructorPreserved=root.UnitValue===nativeUnitValue;",
  "report.projectPreserved=app.project.numItems===beforeItems && app.project.dirty===beforeDirty;",
  "return report;",
  "}());",
]
  .join("\n")
  .trimEnd();
const directory = resolve(root, "tmp/compatibility-host-probe");
mkdirSync(directory, { recursive: true });
for (const item of outputs) writeFileSync(resolve(directory, item.variant + ".jsx"), item.code);
writeFileSync(resolve(directory, "probe.jsx"), probe);
writeFileSync(resolve(directory, "probe-body.jsx"), "return " + probe);
const manifest = {
  outputs: outputs.map(({ variant, sha256 }) => ({ variant, sha256 })),
  probeSha256: createHash("sha256").update(probe).digest("hex"),
  evalBodySha256: createHash("sha256")
    .update("return " + probe)
    .digest("hex"),
  diagnostic: findCompatibilityIssues("for(;;){switch(value){default:continue;}}"),
};
writeFileSync(resolve(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
