import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rollup } from "rollup";
import terser from "@rollup/plugin-terser";
import { minify } from "terser";
import { parse } from "acorn";
import ts from "typescript";
import { protectCompatibility } from "../src/index.js";
import { extendscriptCompat } from "../src/rollup.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const raw = readFileSync(resolve(root, "runtime/index.js"), "utf8");
const bundle = await rollup({
  input: resolve(root, "runtime/index.js"),
  plugins: [terser({ format: { ascii_only: true, comments: /^!/ } }), extendscriptCompat()],
});
let minified;
try {
  const result = await bundle.generate({ format: "iife" });
  const chunk = result.output.find((item) => item.type === "chunk");
  if (!chunk) throw new Error("生成チャンクがない");
  minified = chunk.code;
} finally {
  await bundle.close();
}
parse(raw, { ecmaVersion: 3 });
parse(minified, { ecmaVersion: 3 });
const template = readFileSync(resolve(root, "test/fixtures/template-polyfills.ts"), "utf8")
  .replace(/^import\s+"\.\.\/init";\s*/, "")
  .replace(
    /  const print = \(text: string\) => \{[\s\S]*?\n  \};/,
    "  const print = (text: string) => { $.global.__compatTemplateResults__ = text; };",
  );
if (!template.includes("__compatTemplateResults__"))
  throw new Error("Template output hook missing");
const templateJs = ts.transpileModule(template, {
  compilerOptions: { target: ts.ScriptTarget.ES5 },
}).outputText;
const templateProbe = protectCompatibility(templateJs).code;
parse(templateProbe, { ecmaVersion: 3 });
const unicodeSource =
  '(function () { var text = "' +
  String.fromCharCode(0x200c, 0x200d, 0xfeff) +
  '"; var expression = /A' +
  String.fromCharCode(0x200c) +
  'B/; return { codes: [text.charCodeAt(0), text.charCodeAt(1), text.charCodeAt(2)], matches: expression.test("A" + text.charAt(0) + "B"), rejectsMissing: !expression.test("AB") }; }());';
const unicodeProbe = (
  await minify(unicodeSource, {
    compress: false,
    mangle: false,
    format: { ecma: 5, ascii_only: true },
  })
).code;
if (!unicodeProbe || Array.from(unicodeProbe).some((character) => character.charCodeAt(0) > 127)) {
  throw new Error("Unicode probe is not ASCII");
}
parse(unicodeProbe, { ecmaVersion: 3 });
const directory = resolve(root, "tmp/polyfill-host");
mkdirSync(directory, { recursive: true });
writeFileSync(resolve(directory, "minified.jsx"), minified);
writeFileSync(resolve(directory, "template-test.jsx"), templateProbe);
writeFileSync(resolve(directory, "unicode-evalfile.jsx"), unicodeProbe);
const sha256 = (code) => createHash("sha256").update(code).digest("hex");
const manifest = {
  rawSha256: sha256(raw),
  stringModernFixtureSha256: sha256(
    readFileSync(resolve(root, "test/contracts/string-modern-contract.js")),
  ),
  minifiedSha256: sha256(minified),
  templateProbeSha256: sha256(templateProbe),
  unicodeProbeSha256: sha256(unicodeProbe),
  polyfillFixtureSha256: sha256(readFileSync(resolve(root, "test/contracts/polyfill-contract.js"))),
  correctionFixtureSha256: sha256(
    readFileSync(resolve(root, "test/contracts/runtime-contract.js")),
  ),
  arrayAtHasOwnFixtureSha256: sha256(
    readFileSync(resolve(root, "test/contracts/array-at-has-own-contract.js")),
  ),
  entriesFlatteningStringAtFixtureSha256: sha256(
    readFileSync(resolve(root, "test/contracts/entries-flattening-string-at-contract.js")),
  ),
  includesPaddingTrimmingFixtureSha256: sha256(
    readFileSync(resolve(root, "test/contracts/includes-padding-trimming-contract.js")),
  ),
};
writeFileSync(resolve(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
