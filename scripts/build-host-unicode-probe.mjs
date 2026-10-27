import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { minify } from "terser";
import { protectCompatibility } from "../src/index.js";

const directory = resolve("tmp/unicode-host-probe");
mkdirSync(directory, { recursive: true });
const manifest = {};
function save(name, code) {
  writeFileSync(resolve(directory, name), code, "utf8");
  manifest[name] = createHash("sha256").update(code).digest("hex");
}

for (const [name, units] of [
  ["u200b", [0x200b]],
  ["u200c", [0x200c]],
  ["u200d", [0x200d]],
  ["ufeff", [0xfeff]],
  ["emoji", [0xd83d, 0xde00]],
]) {
  const raw = String.fromCharCode(...units);
  const escaped = units.map((unit) => "\\u" + unit.toString(16).padStart(4, "0")).join("");
  for (const [variant, text] of [
    ["raw", raw],
    ["escaped", escaped],
  ]) {
    save(
      `${name}-string-${variant}.jsx`,
      `(function(){var x="A${text}Z";var a=[];for(var i=0;i<x.length;i++)a.push(x.charCodeAt(i));return a;})()`,
    );
    save(
      `${name}-regex-${variant}.jsx`,
      `(function(){var r=/${text}/;var s=String.fromCharCode(${units.join(",")});return [r.test(s),r.test("X")];})()`,
    );
  }
}
for (const code of [0x200c, 0x200d]) {
  for (const [variant, text] of [
    ["raw", String.fromCharCode(code)],
    ["escaped", "\\u" + code.toString(16)],
  ]) {
    save(
      `identifier-${code.toString(16)}-${variant}.jsx`,
      `(function(){var a${text}b=1;var ab=2;return [a${text}b,ab];})()`,
    );
  }
}
const affected = String.fromCharCode(0x200c, 0x200d, 0xfeff);
const source = `(function(){var s="A${affected}😀Z";var p=/[${affected}]/;var out=[];for(var i=0;i<s.length;i++)out.push(s.charCodeAt(i));return [out,p.test(String.fromCharCode(0x200c)),p.test(String.fromCharCode(0x200d)),p.test(String.fromCharCode(0xfeff)),p.test("X")];})()`;
const minified = (
  await minify(source, { compress: false, mangle: false, format: { ascii_only: false, ecma: 5 } })
).code;
if (!minified) throw new Error("Unicode probe minification produced no output");
for (const [name, input] of [
  ["normal", source],
  ["minified", minified],
]) {
  save(`${name}-protected.jsx`, protectCompatibility(input, { unicode: true }).code);
}
writeFileSync(resolve(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
