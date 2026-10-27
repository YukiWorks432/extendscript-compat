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
  expect(Array.from(runtime).every((character) => character.charCodeAt(0) <= 127)).toBe(true);
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

it("正常なtrimは維持し、不完全なtrimは空白と非空白の両方を補正する", () => {
  const native = createContext({});
  runInContext("var originalTrim = String.prototype.trim", native);
  runInContext(runtime, native);
  expect(runInContext("originalTrim === String.prototype.trim", native)).toBe(true);
  expect(runInContext(contract, native).failures).toEqual([]);

  const broken = createContext({});
  runInContext(
    `String.prototype.trim = function () {
      return String(this).replace(/^ +| +$/g, "");
    };`,
    broken,
  );
  runInContext(runtime, broken);
  expect(runInContext(contract, broken).failures).toEqual([]);
});

it("既存テンプレートのキャッシュがあってもtrimとNumber.parseIntを補正する", () => {
  const context = createContext({});
  runInContext(
    `var $ = { global: globalThis };
    $.global.__ES_TS_TEMPLATE_ES5_SHIM__ = { version: "v1" };
    $.global.__ES_TS_TEMPLATE_ES6_SHIM__ = { version: "v1" };
    String.prototype.trim = function () { return String(this); };
    Number.parseInt = function () { return -1; };`,
    context,
  );
  runInContext(runtime, context);
  expect(runInContext(contract, context).failures).toEqual([]);
});

it("置換可能な旧Numberの文字列変換にtrimと非空白の判定を適用する", () => {
  const context = createContext({});
  runInContext(
    `var NativeNumber = Number;
    Number = function LegacyNumber(value) {
      if (typeof value === "string" && /^0[bo]/i.test(value)) return NaN;
      if (typeof value === "string" && value.indexOf(String.fromCharCode(0x200b)) !== -1) return 0;
      return arguments.length ? NativeNumber(value) : 0;
    };
    Number.prototype = NativeNumber.prototype;`,
    context,
  );
  runInContext(runtime, context);
  expect(
    runInContext(
      'Number(String.fromCharCode(0xa0) + "0b101" + String.fromCharCode(0x202f))',
      context,
    ),
  ).toBe(5);
  // 非空白の判定が前回の正規表現の状態に影響されないことを確認する。
  expect(runInContext('isNaN(Number(String.fromCharCode(0x200b) + "0"))', context)).toBe(true);
  expect(runInContext('isNaN(Number(String.fromCharCode(0x200b) + "0"))', context)).toBe(true);
});

it("壊れた元のparseIntを参照せず、補正後の関数をNumber.parseIntで使う", () => {
  const context = createContext({});
  runInContext(
    `var nativeParseInt = parseInt;
    parseInt = function (value, radix) {
      if (String(value) === "a?" && radix === 16) return 175;
      return nativeParseInt(value, radix);
    };
    Number.parseInt = parseInt;`,
    context,
  );
  runInContext(runtime, context);
  expect(runInContext('Number.parseInt("a?", 16)', context)).toBe(10);
  expect(runInContext("Number.parseInt === parseInt", context)).toBe(true);
  expect(runInContext('Number.parseInt("101", 2)', context)).toBe(5);
  runInContext(runtime, context);
  expect(runInContext('Number.parseInt("a?", 16)', context)).toBe(10);
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
