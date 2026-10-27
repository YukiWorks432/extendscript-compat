import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { parse } from "acorn";
import ts from "typescript";
import { protectCompatibility } from "../src/index.js";
import { rollup } from "rollup";
import terser from "@rollup/plugin-terser";
import { extendscriptCompat } from "../src/rollup.js";

const runtimePath = new URL("../runtime/index.js", import.meta.url);
const runtime = readFileSync(runtimePath, "utf8");
const oldRuntime = readFileSync(new URL("./fixtures/runtime-0.2.js", import.meta.url), "utf8");
const contract = readFileSync(new URL("./fixtures/polyfill-contract.js", import.meta.url), "utf8");
const corrections = readFileSync(
  new URL("./fixtures/runtime-contract.js", import.meta.url),
  "utf8",
);
const missing = `
  var $ = { global: globalThis };
  JSON = undefined;
  delete Array.prototype.map;
  delete Array.prototype.filter;
  delete Array.prototype.reduce;
  delete Array.isArray;
  delete Object.keys;
  delete Function.prototype.bind;
  delete String.prototype.trim;
  delete Array.from;
  delete Array.of;
  delete Array.prototype.find;
  delete Array.prototype.findIndex;
  delete String.prototype.startsWith;
  delete String.prototype.endsWith;
  delete Number.isFinite;
  delete Object.assign;
  delete Math.trunc;
`;

it("生成した直接読込用コードはES3として解析できる", () => {
  expect(() => parse(runtime, { ecmaVersion: 3 })).not.toThrow();
});

it("共有エンジンに不足するJSON・ES5・ES6を補い、既存の不具合補正も適用する", () => {
  const context = createContext({});
  runInContext(missing, context);
  runInContext(runtime, context);
  expect(runInContext(contract, context).failures).toEqual([]);
  expect(runInContext(corrections, context).failures).toEqual([]);
  runInContext(
    "var refs = [JSON.parse, Array.prototype.map, Array.from, parseInt, String.prototype.replace]",
    context,
  );
  runInContext(runtime, context);
  expect(
    runInContext(
      "refs[0] === JSON.parse && refs[1] === Array.prototype.map && refs[2] === Array.from && refs[3] === parseInt && refs[4] === String.prototype.replace",
      context,
    ),
  ).toBe(true);
});

it("0.2.0と異なる順で読み込んでも補正が有効で、同じエンジンへの再適用を防ぐ", () => {
  for (const first of [oldRuntime, runtime]) {
    const context = createContext({});
    runInContext("var $ = { global: globalThis };", context);
    runInContext(first, context);
    runInContext(first === oldRuntime ? runtime : oldRuntime, context);
    expect(runInContext(contract, context).failures).toEqual([]);
    expect(runInContext(corrections, context).failures).toEqual([]);
    runInContext(
      "var refs = [parseInt, String.prototype.charAt, String.prototype.split, String.prototype.replace]",
      context,
    );
    runInContext(oldRuntime, context);
    runInContext(runtime, context);
    expect(
      runInContext(
        "refs[0] === parseInt && refs[1] === String.prototype.charAt && refs[2] === String.prototype.split && refs[3] === String.prototype.replace",
        context,
      ),
    ).toBe(true);
  }
});

it("不完全なJSON実装を補正し、正常なJSON実装は保持する", () => {
  const broken = createContext({});
  runInContext(
    `JSON.parse = function (text) { return eval("(" + text + ")"); };
    JSON.stringify = function (value) { return '{"n":' + value.n + '}'; };`,
    broken,
  );
  runInContext(runtime, broken);
  expect(runInContext(contract, broken).failures).toEqual([]);

  const native = createContext({});
  runInContext("var parseBefore = JSON.parse, stringifyBefore = JSON.stringify", native);
  runInContext(runtime, native);
  expect(
    runInContext("parseBefore === JSON.parse && stringifyBefore === JSON.stringify", native),
  ).toBe(true);
});
it("通常のESM環境でJSONがなくても初期化でき、既存のtrimがあっても失敗しない", () => {
  const context = createContext({});
  runInContext("JSON = undefined", context);
  runInContext('"use strict";\n' + runtime, context);
  expect(runInContext(contract, context).failures).toEqual([]);
});

it.each([false, true])("配布入口から%s圧縮のバンドルへ補完と補正を含める", async (minified) => {
  const bundle = await rollup({
    input: "entry",
    plugins: [
      {
        name: "entry",
        resolveId(id) {
          if (id === "entry") return id;
          if (id === "extendscript-compat/runtime") return fileURLToPath(runtimePath);
        },
        load(id) {
          if (id === "entry") return 'import "extendscript-compat/runtime";';
        },
      },
      ...(minified ? [terser()] : []),
      extendscriptCompat(),
    ],
  });
  try {
    const generated = await bundle.generate({ format: "iife" });
    const chunk = generated.output[0];
    if (chunk.type !== "chunk") throw new Error("生成チャンクがない");
    const context = createContext({});
    runInContext(missing, context);
    runInContext(chunk.code, context);
    expect(runInContext(contract, context).failures).toEqual([]);
    expect(runInContext(corrections, context).failures).toEqual([]);
  } finally {
    await bundle.close();
  }
});

it("移行元テンプレートの機能テストを欠損環境で実行する", () => {
  const context = createContext({});
  runInContext(
    missing +
      `
    delete Array.prototype.forEach;
    delete Array.prototype.some;
    delete Array.prototype.every;
    delete Array.prototype.reduceRight;
    delete Array.prototype.keys;
    delete Array.prototype.values;
    delete Array.prototype.entries;
    delete String.prototype.includes;
    delete String.fromCodePoint;
    delete Number.isNaN;
    delete Date.now;
    delete Object.is;
    function Window() {
      this.add = function (kind, bounds, text) { this.text = text; };
      this.show = function () { globalThis.templateResults = this.text; };
    }
  `,
    context,
  );
  runInContext(runtime, context);
  const template = readFileSync(
    new URL("./fixtures/template-polyfills.ts", import.meta.url),
    "utf8",
  );
  const source = template.replace(/^import\s+"\.\.\/init";\s*/, "");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES5 },
  }).outputText;
  runInContext(protectCompatibility(javascript).code, context);
  const results = String(runInContext("templateResults", context));
  expect(results).toContain("Summary: OK=48, NG=0");
});
