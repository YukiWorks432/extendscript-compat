import { readFileSync, writeFileSync } from "node:fs";
import { parse, traverse } from "@babel/core";
import MagicString from "magic-string";
import { minify } from "terser";
import { protectCompatibility } from "../src/index.js";
import { prototypeMethods, staticMethods } from "../src/ponyfill-definitions.js";

const source = (name) => readFileSync(new URL(`../runtime-src/${name}`, import.meta.url), "utf8");

// 既存shimの関数と、その関数が参照する宣言だけを取り出す。導入処理は実行しない。
function extract(file, selections, es5) {
  const code = source(file);
  const ast = parse(code, { babelrc: false, configFile: false, sourceType: "script" });
  const values = new Map();
  traverse(ast, {
    VariableDeclarator(path) {
      if (path.node.id.type === "Identifier" && path.node.init) {
        values.set(path.node.id.name, path.get("init"));
        if (path.node.init.type === "ObjectExpression") {
          for (const property of path.get("init.properties")) {
            if (property.isObjectProperty() && property.node.key.type === "Identifier")
              values.set(path.node.id.name + "." + property.node.key.name, property.get("value"));
          }
        }
      }
    },
    CallExpression(path) {
      const callee = path.node.callee;
      if (
        !(callee.type === "Identifier" && callee.name === "defineProperties") &&
        !(
          callee.type === "MemberExpression" &&
          code.slice(callee.start, callee.end) === "Object.assign"
        )
      )
        return;
      const [target, properties] = path.get("arguments");
      if (!properties?.isObjectExpression()) return;
      const name = code.slice(target.node.start, target.node.end);
      for (const property of properties.get("properties")) {
        if (!property.isObjectProperty() || property.node.key.type !== "Identifier") continue;
        const key = name + "." + property.node.key.name;
        if (!values.has(key)) values.set(key, property.get("value"));
      }
    },
    AssignmentExpression(path) {
      const name = code.slice(path.node.left.start, path.node.left.end);
      if (!values.has(name) && path.get("right").isFunctionExpression())
        values.set(name, path.get("right"));
    },
  });
  const definitions = new Map();
  const statements = new Map();
  const replacements = new Map(
    es5
      ? []
      : [
          ["NativeDate", "Date"],
          ["globals", "__nativeGlobals"],
          ["$iterator$", "__iteratorKey"],
          ["ReflectShims", "__nativeGlobals.Reflect"],
        ],
  );
  const selected = [];
  function collect(path) {
    const visit = (reference) => {
      const name = reference.node.name;
      const binding = reference.scope.getBinding(name);
      if (
        !binding ||
        (binding.path.node.start >= path.node.start && binding.path.node.end <= path.node.end)
      )
        return;
      if (replacements.has(name) || definitions.has(binding)) return;
      if (binding.kind === "param") {
        if (name === "NativeDate") {
          replacements.set(name, "Date");
          return;
        }
        throw new Error(`Unexpected shim closure parameter: ${file}: ${name}`);
      }
      let init = binding.path.isVariableDeclarator() ? binding.path.get("init") : binding.path;
      if (!init.node) {
        const assignment = binding.constantViolations.find(
          (p) =>
            p.isAssignmentExpression({ operator: "=" }) ||
            (p.isVariableDeclarator() && p.node.init),
        );
        if (!assignment) throw new Error(`Shim declaration has no implementation: ${name}`);
        init = assignment.get(assignment.isVariableDeclarator() ? "init" : "right");
      }
      definitions.set(binding, { name, init, start: init.node.start });
      collect(init);
      if (name === "ArrayIterator" || name === "StringIterator") {
        traverse(ast, {
          ExpressionStatement(statement) {
            const expression = statement.node.expression;
            const target =
              expression.type === "AssignmentExpression"
                ? expression.left
                : expression.type === "CallExpression"
                  ? expression.arguments[0]
                  : undefined;
            if (!target || target.start == null || target.end == null) return;
            const text = code.slice(target.start, target.end);
            if (text !== name + ".prototype" && !text.startsWith(name + ".prototype.")) return;
            statements.set(statement.node.start, statement);
            collect(statement);
          },
        });
      }
    };
    if (path.isReferencedIdentifier()) visit(path);
    path.traverse({ ReferencedIdentifier: visit });
  }
  for (const [name, selector] of Object.entries(selections)) {
    const value = values.get(selector);
    if (!value) throw new Error(`Shim implementation not found: ${file}: ${selector}`);
    collect(value);
    if (selector === "StringIterator")
      collect(value.scope.getBinding("StringIterator").referencePaths[0]);
    selected.push([name, value]);
  }
  function print(path) {
    const start = path.node.start;
    const s = new MagicString(code.slice(start, path.node.end));
    const edits = [];
    // 元のshimの条件付き補正を単独で使っても、無効な日付を文字列化できるようにする。
    if (
      ["toString", "toUTCString", "toDateString"].some(
        (name) => path === values.get("Date.prototype." + name),
      )
    )
      edits.push([
        path.node.body.start + 1,
        path.node.body.start + 1,
        '\nif (isNaN(Date.prototype.getTime.call(this))) return "Invalid Date";\n',
      ]);
    const visitors = {
      IfStatement(p) {
        // ゼロでも指定桁数を保持する。元のshimはここでfを0へ上書きしてしまう。
        if (
          path === values.get("NumberPrototype.toExponential") &&
          code.slice(p.node.test.start, p.node.test.end) === "x === 0"
        ) {
          edits.push([
            p.node.consequent.start,
            p.node.consequent.end,
            '{ e = 0; m = new Array(f + 2).join("0"); }',
          ]);
          p.skip();
        }
      },
      FunctionExpression(p) {
        if (
          !es5 &&
          p.parentPath.isObjectProperty() &&
          p.parentPath.node.key.type === "Identifier" &&
          p.parentPath.node.key.name === "GetMethod"
        ) {
          edits.push([
            p.node.body.start + 1,
            p.node.body.start + 1,
            `
if (p === __iteratorKey && !(p in Object(o))) {
  if (Type.string(o)) return function () { return new StringIterator(this); };
  if (__es5.isArray(o)) return function () { return new ArrayIterator(this, "value"); };
}
`,
          ]);
        }
      },
      CallExpression(p) {
        const callee = p.node.callee;
        // 桁数省略時も、AEが返すゼロの指数「+00」を標準の「+0」へ揃える。
        if (
          path === values.get("NumberPrototype.toExponential") &&
          callee.type === "Identifier" &&
          callee.name === "originalToExponential" &&
          p.node.arguments.length === 1
        ) {
          edits.push([p.node.start, p.node.end, 'x === 0 ? "0e+0" : originalToExponential(x)']);
          p.skip();
          return;
        }
        // ExtendScriptの単項+はオブジェクトのvalueOfを扱えないため、桁数を先に変換する。
        if (
          path === values.get("NumberPrototype.toExponential") &&
          code.slice(callee.start, callee.end) === "ES.ToInteger"
        ) {
          const argument = p.node.arguments[0];
          edits.push([
            argument.start,
            argument.end,
            `toNumber(${code.slice(argument.start, argument.end)})`,
          ]);
        }
        if (callee.type === "Identifier" && callee.name === "Number")
          edits.push([callee.start, callee.end, "toNumber"]);
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          callee.property.name === "bind"
        ) {
          edits.push([
            callee.start,
            callee.object.start,
            es5 ? "__bind.call(" : "__es5.bind.call(",
          ]);
          edits.push([callee.object.end, callee.end + 1, p.node.arguments.length ? ", " : ""]);
        }
      },
      MemberExpression(p) {
        const text = code.slice(p.node.start, p.node.end);
        if (
          es5 &&
          !p.node.computed &&
          p.node.property.type === "Identifier" &&
          p.node.property.name === "toISOString"
        ) {
          edits.push([
            p.node.start,
            p.node.end,
            `getMethod(${code.slice(p.node.object.start, p.node.object.end)}, "toISOString")`,
          ]);
          p.skip();
          return;
        }
        const base = {
          "Array.prototype.forEach": "__es5.forEach",
          "Array.prototype.map": "__es5.map",
          "Array.prototype.filter": "__es5.filter",
          "Array.prototype.some": "__es5.some",
          "Array.prototype.reduce": "__es5.reduce",
          "Array.prototype.indexOf": "__es5.indexOf",
          "Array.isArray": "__es5.isArray",
          "Object.keys": "__es5.keys",
          "Number.EPSILON": "2.220446049250313e-16",
          "Number.MAX_SAFE_INTEGER": "9007199254740991",
          "Math.expm1": "__es6.expm1",
          "Function.bind": "__es5.bind",
          "Function.prototype.bind": "__es5.bind",
        };
        if (!es5 && base[text]) {
          edits.push([p.node.start, p.node.end, base[text]]);
          p.skip();
        }
      },
      ReferencedIdentifier(p) {
        if (replacements.has(p.node.name))
          edits.push([p.node.start, p.node.end, replacements.get(p.node.name)]);
      },
    };
    if (path.isCallExpression()) visitors.CallExpression(path);
    if (path.isMemberExpression()) visitors.MemberExpression(path);
    if (path.isReferencedIdentifier()) visitors.ReferencedIdentifier(path);
    path.traverse(visitors);
    for (const [a, b, text] of edits.sort((a, b) => b[0] - a[0])) {
      if (a === b) s.appendLeft(a - start, text);
      else s.overwrite(a - start, b - start, text);
    }
    return s.toString();
  }
  const ordered = [...definitions.values()]
    .map(({ name, init, start }) => ({ start, code: `var ${name} = ${print(init)};` }))
    .concat([...statements].map(([start, path]) => ({ start, code: print(path) })))
    .sort((a, b) => a.start - b.start);
  // bindの補完自身は、ネイティブbindのないホストでも初期化できる順序に置く。
  if (es5) {
    const bind = values.get("FunctionPrototype.bind");
    const index = ordered.findIndex((item) => item.start > bind.node.start);
    ordered.splice(index < 0 ? ordered.length : index, 0, {
      start: bind.node.start,
      code: `var __bind = ${print(bind)};`,
    });
  }
  return `(function () {\n${ordered.map((item) => item.code).join("\n")}\nreturn {${selected.map(([name, value]) => `${name}: ${print(value)}`).join(",\n")}};\n}())`;
}

const es5 = {
  bind: "FunctionPrototype.bind",
  isArray: "$Array.isArray",
  keys: "$Object.keys",
  parse: "parseShim",
};
for (const name of [
  "forEach",
  "map",
  "filter",
  "every",
  "some",
  "reduce",
  "reduceRight",
  "indexOf",
  "lastIndexOf",
  "unshift",
  "splice",
  "join",
  "push",
  "slice",
  "sort",
])
  es5[name] = `ArrayPrototype.${name}`;
for (const name of [
  "getFullYear",
  "getMonth",
  "getDate",
  "getUTCFullYear",
  "getUTCMonth",
  "getUTCDate",
  "toString",
  "toUTCString",
  "toDateString",
  "toISOString",
  "toJSON",
])
  es5["date_" + name] = `Date.prototype.${name}`;
for (const name of ["toFixed", "toExponential", "toPrecision"])
  es5[name] = `NumberPrototype.${name}`;
es5.substr = "StringPrototype.substr";
es5.lastIndexOfString = "StringPrototype.lastIndexOf";
const es6 = {
  assign: "ObjectShims.assign",
  is: "ObjectShims.is",
  fromCodePoint: "StringShims.fromCodePoint",
  raw: "StringShims.raw",
  from: "ArrayShims.from",
  of: "ArrayShims.of",
  stringIterator: "StringIterator",
};
for (const name of ["repeat", "startsWith", "endsWith", "includes", "codePointAt"])
  es6["string_" + name] = `StringPrototypeShims.${name}`;
for (const name of ["copyWithin", "fill", "find", "findIndex", "keys", "values", "entries"])
  es6["array_" + name] = `ArrayPrototypeShims.${name}`;
for (const name of staticMethods.Math) es6[name] = "MathShims." + name;
for (const name of staticMethods.Reflect) es6["reflect_" + name] = "ReflectShims." + name;

let json = source("vendor/json2.js");
const jsonAst = parse(json, { babelrc: false, configFile: false, sourceType: "script" });
const jsonEdit = new MagicString(json);
traverse(jsonAst, {
  IfStatement(path) {
    if (
      json.slice(path.node.test.start, path.node.test.end).includes("typeof Date.prototype.toJSON")
    ) {
      jsonEdit.remove(path.node.start, path.node.end);
      path.skip();
    }
  },
});
json = jsonEdit
  .toString()
  .replace(
    "var value = holder[key];",
    `var value = holder[key];
if (value && typeof value === "object" && !("toJSON" in value) && __dateBrand(value)) value = __es5.date_toJSON.call(value, key);`,
  )
  .replace(
    "switch (typeof value)",
    `if (value && typeof value === "object") {
var brand = Object.prototype.toString.call(value);
if (brand === "[object Number]" || brand === "[object String]" || brand === "[object Boolean]") value = value.valueOf();
}
switch (typeof value)`,
  );
let corrections = source("builtin-corrections.js")
  .replace("var stringPrototype = String.prototype;", "var stringPrototype = __stringCorrections;")
  .replace('})(typeof $ === "undefined" ? globalThis : $.global);', "})(__parseCorrections);");
const helpers = [
  "polyfill-helpers.js",
  "polyfills/array.js",
  "polyfills/string.js",
  "polyfills/object.js",
  "trim.js",
]
  .map((file) => {
    const code = source(file);
    const ast = parse(code, { babelrc: false, configFile: false, sourceType: "script" });
    const s = new MagicString(code);
    traverse(ast, {
      FunctionDeclaration(path) {
        if (/Works$|DefinesElements$|^__compatInstall$/.test(path.node.id.name)) {
          s.remove(path.node.start, path.node.end);
          path.skip();
        }
      },
      MemberExpression(path) {
        const text = code.slice(path.node.start, path.node.end);
        const replacement = {
          "Array.isArray": "__es5.isArray",
          "Object.keys": "__es5.keys",
          "String.prototype.replace": "__stringCorrections.replace",
        }[text];
        if (replacement) {
          s.overwrite(path.node.start, path.node.end, replacement);
          path.skip();
        }
      },
      CallExpression(path) {
        const callee = path.node.callee;
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          callee.property.name === "charAt"
        ) {
          s.appendLeft(callee.object.start, "__stringCorrections.charAt.call(");
          s.overwrite(callee.object.end, callee.end + 1, ", ");
        }
      },
    });
    return s.toString();
  })
  .join("\n");
const core = source("ponyfill-core.js")
  .replace("/* ES5 */", `var __es5 = ${extract("vendor/es5-shim.js", es5, true)};`)
  .replace("/* ES6 */", `var __es6 = ${extract("vendor/es6-shim.js", es6, false)};`)
  .replace("/* CORRECTIONS */", corrections)
  .replace("/* HELPERS */", helpers)
  .replace("/* JSON */", `(function () { var JSON = __json;\n${json}\n}());`)
  .replace(
    "/* TABLES */",
    `var __staticNames = ${JSON.stringify(staticMethods)}; var __prototypeNames = ${JSON.stringify(prototypeMethods)};`,
  );
const number = readFileSync(new URL("../runtime/number.js", import.meta.url), "utf8").replace(
  "export function",
  "function",
);
const result = await minify(
  `/*! Generated by scripts/build-ponyfill.mjs. Sources and licenses: runtime/README.md and THIRD-PARTY-LICENSES.txt. */\n${number}\n${core.replaceAll("export function", "function")}`,
  {
    module: true,
    compress: false,
    mangle: false,
    format: { ecma: 5, ie8: true, beautify: true, ascii_only: true, comments: /^!/ },
  },
);
const output =
  protectCompatibility(result.code).code +
  "\nexport { getStatic, getPrototypeMethod, getMethod, getParseInt, callMethod };\n";
const path = new URL("../runtime/ponyfill.js", import.meta.url);
if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8") !== output)
    throw new Error("runtime/ponyfill.js is not up to date");
} else writeFileSync(path, output);
