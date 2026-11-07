import { readFileSync, writeFileSync } from "node:fs";
import { parse, traverse } from "@babel/core";
import { minify } from "terser";
const rawRuntime = readFileSync(new URL("../runtime/ponyfill.js", import.meta.url), "utf8").replace(
  /export \{[^}]+\};\s*$/,
  "",
);
const freeNames = new Set();
traverse(parse(rawRuntime), {
  ReferencedIdentifier(path) {
    if (!path.scope.getBinding(path.node.name) && path.node.name !== "arguments")
      freeNames.add(path.node.name);
  },
});
const globals = [...freeNames].sort();
const runtimeFactory = `(function(){${rawRuntime}\nreturn {getStatic:getStatic,getPrototypeMethod:getPrototypeMethod,getMethod:getMethod,getParseInt:getParseInt,callMethod:callMethod,toNumber:toNumber};})`;
const factoryDeclaration = (
  await minify("var factory=" + runtimeFactory + ";", {
    compress: { typeofs: false },
    mangle: true,
    format: { ascii_only: true, ie8: true, comments: /^!/ },
  })
).code;

const factory = factoryDeclaration.slice(factoryDeclaration.indexOf("=") + 1).replace(/;$/, "");

const generated =
  "export const globals = " +
  JSON.stringify(globals) +
  ";\nexport const factorySource = " +
  JSON.stringify(factory) +
  ";\n";
const target = new URL("../runtime/ponyfill-factory.js", import.meta.url);
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== generated)
    throw new Error("runtime/ponyfill-factory.js is not up to date");
} else writeFileSync(target, generated);
