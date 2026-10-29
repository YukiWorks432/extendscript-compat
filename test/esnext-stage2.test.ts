import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { parse } from "acorn";
import { rollup } from "rollup";
import terser from "@rollup/plugin-terser";
import ts from "typescript";
import { extendscriptCompat } from "../src/rollup.js";

const runtimePath = fileURLToPath(new URL("../runtime/index.js", import.meta.url));
const runtime = readFileSync(runtimePath, "utf8");
const contract = readFileSync(
  new URL("./fixtures/esnext-stage2-contract.js", import.meta.url),
  "utf8",
);
const previousContract = readFileSync(
  new URL("./fixtures/esnext-stage1-contract.js", import.meta.url),
  "utf8",
);
const missing = `
  delete Object.entries; delete Object.values;
  delete Array.prototype.flat; delete Array.prototype.flatMap; delete String.prototype.at;
`;

it("実機向けの検証資料はES3で解析できる", () => {
  expect(() => parse(contract, { ecmaVersion: 3 })).not.toThrow();
});

it("第1段階が適用済みでも対象を補い、再評価しても関数を保持する", () => {
  const context = createContext({});
  runInContext(runtime, context);
  runInContext(missing + "delete globalThis.__extendscriptCompatESNext2__", context);
  runInContext(runtime, context);
  expect(runInContext(contract, context).failures).toEqual([]);
  expect(runInContext(previousContract, context).failures).toEqual([]);
  runInContext(
    "var refs = [Object.entries, Object.values, Array.prototype.flat, Array.prototype.flatMap, String.prototype.at]",
    context,
  );
  runInContext(runtime, context);
  expect(runInContext(contract, context).failures).toEqual([]);
  expect(
    runInContext(
      "refs[0] === Object.entries && refs[1] === Object.values && refs[2] === Array.prototype.flat && refs[3] === Array.prototype.flatMap && refs[4] === String.prototype.at",
      context,
    ),
  ).toBe(true);
});

it("不完全な既存メソッドを補い、正常な既存メソッドを維持する", () => {
  const native = createContext({});
  runInContext(
    "var refs = [Object.entries, Object.values, Array.prototype.flat, Array.prototype.flatMap, String.prototype.at]",
    native,
  );
  runInContext(runtime, native);
  expect(
    runInContext(
      "refs[0] === Object.entries && refs[1] === Object.values && refs[2] === Array.prototype.flat && refs[3] === Array.prototype.flatMap && refs[4] === String.prototype.at",
      native,
    ),
  ).toBe(true);
  const broken = createContext({});
  runInContext(
    "Object.entries = Object.values = Array.prototype.flat = Array.prototype.flatMap = String.prototype.at = function () { return []; }",
    broken,
  );
  runInContext(runtime, broken);
  expect(runInContext(contract, broken).failures).toEqual([]);
});

it("AEの文字列位置に関する属性の誤判定を補い、Object自身に含まれる別のキーも取得する", () => {
  const context = createContext({});
  runInContext(
    missing +
      `
    globalThis.__extendscriptCompatPolyfills__ = 1;
    globalThis.__extendscriptCompatESNext1__ = 1;
    Object.getOwnPropertyNames = undefined; Object.getOwnPropertyDescriptor = undefined;
    var nativeOwn = Object.prototype.hasOwnProperty;
    var nativeEnumerable = Object.prototype.propertyIsEnumerable;
    Object.prototype.hasOwnProperty = function (key) {
      if (Object.prototype.toString.call(this) === "[object String]" && (key === "0" || key === "1")) return false;
      return nativeOwn.call(this, key);
    };
    Object.prototype.propertyIsEnumerable = function (key) {
      if (Object.prototype.toString.call(this) === "[object String]" && (key === "0" || key === "1")) return false;
      return nativeEnumerable.call(this, key);
    };
  `,
    context,
  );
  runInContext(runtime, context);
  expect(runInContext('JSON.stringify(Object.entries("ab"))', context)).toBe(
    '[["0","a"],["1","b"]]',
  );
  expect(runInContext("JSON.stringify(Object.values({a:1,b:2}))", context)).toBe("[1,2]");
});

it("flatMapは途中で削除された要素を飛ばし、最初に取得した長さまで走査する", () => {
  const context = createContext({});
  runInContext(missing, context);
  runInContext(runtime, context);
  expect(
    runInContext(
      `var a=[1,2,3]; a.flatMap(function (x,i) { if(i===0) { delete a[1]; a.push(4); } return [x]; }).join(",")`,
      context,
    ),
  ).toBe("1,3");
});

it.each([false, true])("配布入口の圧縮=%sの出力で第1・第2段階の契約を満たす", async (minified) => {
  const bundle = await rollup({
    input: "entry",
    plugins: [
      {
        name: "entry",
        resolveId(id) {
          if (id === "entry") return id;
          if (id === "extendscript-compat/runtime") return runtimePath;
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
    const { output } = await bundle.generate({ format: "iife" });
    const chunk = output[0];
    if (chunk.type !== "chunk") throw new Error("生成チャンクがない");
    const context = createContext({});
    runInContext(missing, context);
    runInContext(chunk.code, context);
    expect(runInContext(contract, context).failures).toEqual([]);
    expect(runInContext(previousContract, context).failures).toEqual([]);
  } finally {
    await bundle.close();
  }
});

it("新しい宣言は既存のES2022標準ライブラリとも共存する", () => {
  const fixture = fileURLToPath(
    new URL("./fixtures/esnext-stage2-types-modern.ts", import.meta.url),
  );
  const program = ts.createProgram([fixture], {
    noEmit: true,
    strict: true,
    skipLibCheck: false,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.es2022.d.ts"],
    types: [],
  });
  expect(
    ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")),
  ).toEqual([]);
});

it("AEの挿入順の整数キーを数値順へ直し、その他のキーの順序を保つ", () => {
  const context = createContext({});
  runInContext(
    missing +
      `
    globalThis.__extendscriptCompatPolyfills__ = 1;
    globalThis.__extendscriptCompatESNext1__ = 1;
    Object.getOwnPropertyNames = undefined; Object.getOwnPropertyDescriptor = undefined;
    var obj = {"2":"b", "1":"a", "z":"z"}, nativeKeys = Object.keys;
    Object.keys = function (value) { return value === obj ? ["2","1","z"] : nativeKeys(value); };
  `,
    context,
  );
  runInContext(runtime, context);
  expect(runInContext("JSON.stringify(Object.entries(obj))", context)).toBe(
    '[["1","a"],["2","b"],["z","z"]]',
  );
});

it("属性情報がある環境では列挙中に変更された属性を各値の取得前に確認する", () => {
  const context = createContext({});
  runInContext(missing, context);
  runInContext(runtime, context);
  expect(
    runInContext(
      `
    var obj = {};
    Object.defineProperty(obj,"a",{enumerable:true,get:function(){Object.defineProperty(obj,"b",{enumerable:true});return 1;}});
    Object.defineProperty(obj,"b",{enumerable:false,configurable:true,value:2});
    JSON.stringify(Object.entries(obj));
  `,
      context,
    ),
  ).toBe('[["a",1],["b",2]]');
});

it("flatMapは長さを取得した後でコールバックを検査する", () => {
  const context = createContext({});
  runInContext(missing, context);
  runInContext(runtime, context);
  expect(
    runInContext(
      `
    var calls=0, obj={};
    Object.defineProperty(obj,"length",{get:function(){calls++;return 0;}});
    try { Array.prototype.flatMap.call(obj, null); } catch (error) {}
    calls;
  `,
      context,
    ),
  ).toBe(1);
});

it("第1段階で追加された列挙可能な配列メソッドをentriesとvaluesに含めない", () => {
  const context = createContext({});
  runInContext(
    missing +
      `
    globalThis.__extendscriptCompatPolyfills__ = 1;
    globalThis.__extendscriptCompatESNext1__ = 1;
    Object.getOwnPropertyNames = undefined; Object.getOwnPropertyDescriptor = undefined;
    Array.prototype.includes = function () {};
  `,
    context,
  );
  runInContext(runtime, context);
  expect(runInContext("JSON.stringify(Object.entries([4,5]))", context)).toBe('[["0",4],["1",5]]');
  expect(runInContext("JSON.stringify(Object.values([4,5]))", context)).toBe("[4,5]");
});
