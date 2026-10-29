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
  new URL("./fixtures/esnext-stage3-contract.js", import.meta.url),
  "utf8",
);
const previous = readFileSync(
  new URL("./fixtures/esnext-stage2-contract.js", import.meta.url),
  "utf8",
);
const missing = "delete Array.prototype.at; delete Object.hasOwn;";

it("実機用の契約検証はES3で解析できる", () => {
  expect(() => parse(contract, { ecmaVersion: 3 })).not.toThrow();
});

it("既存ランタイム適用後にも補完し、再評価で関数を保持する", () => {
  const context = createContext({});
  runInContext(runtime, context);
  runInContext(missing + "delete globalThis.__extendscriptCompatESNext3__", context);
  runInContext(runtime, context);
  expect(runInContext(contract, context).failures).toEqual([]);
  expect(runInContext(previous, context).failures).toEqual([]);
  runInContext("var atRef=Array.prototype.at, ownRef=Object.hasOwn", context);
  runInContext(runtime, context);
  expect(runInContext("atRef===Array.prototype.at && ownRef===Object.hasOwn", context)).toBe(true);
});

it("正常な既存メソッドを保持し、不完全なメソッドを置換する", () => {
  const native = createContext({});
  runInContext("var atRef=Array.prototype.at, ownRef=Object.hasOwn", native);
  runInContext(runtime, native);
  expect(runInContext("atRef===Array.prototype.at && ownRef===Object.hasOwn", native)).toBe(true);
  const broken = createContext({});
  runInContext("Array.prototype.at = Object.hasOwn = function(){return false}", broken);
  runInContext(runtime, broken);
  expect(runInContext(contract, broken).failures).toEqual([]);
});

it("Symbolを返すプロパティキーの変換を一度だけ行う", () => {
  const context = createContext({});
  runInContext(missing, context);
  runInContext(runtime, context);
  expect(
    runInContext(
      `
    var symbol = Symbol("key"), object = {}, calls = 0;
    object[symbol] = 1;
    var key = { [Symbol.toPrimitive]: function (hint) { calls++; return hint === "string" ? symbol : "wrong"; } };
    Object.hasOwn(object, key) && calls === 1;
  `,
      context,
    ),
  ).toBe(true);
});

it("削除された関数名は継承プロパティとして扱う", () => {
  const context = createContext({});
  runInContext(missing, context);
  runInContext(runtime, context);
  expect(
    runInContext("var f = function named() {}; delete f.name; Object.hasOwn(f, 'name')", context),
  ).toBe(false);
});

it("AEで取得できない文字列と配列の所有属性を補う", () => {
  const context = createContext({});
  runInContext(
    missing +
      `
    var originalOwn=Object.prototype.hasOwnProperty;
    Object.prototype.hasOwnProperty=function(key) {
      var kind=Object.prototype.toString.call(this);
      if ((kind==="[object String]" && (key==="length" || key==="0" || key==="1" || key==="2")) ||
          (kind==="[object Array]" && key==="length")) return false;
      return originalOwn.call(this,key);
    };
  `,
    context,
  );
  runInContext(runtime, context);
  expect(runInContext(contract, context).failures).toEqual([]);
});

it.each([false, true])("配布入口を圧縮=%sで利用した場合に契約を満たす", async (minified) => {
  const bundle = await rollup({
    input: runtimePath,
    plugins: [...(minified ? [terser()] : []), extendscriptCompat()],
  });
  try {
    const result = await bundle.generate({ format: "iife" });
    const chunk = result.output[0];
    if (chunk.type !== "chunk") throw new Error("生成チャンクがない");
    const context = createContext({});
    runInContext(missing, context);
    runInContext(chunk.code, context);
    expect(runInContext(contract, context).failures).toEqual([]);
    expect(runInContext(previous, context).failures).toEqual([]);
  } finally {
    await bundle.close();
  }
});

it("追加した型はES5とES2022の標準型と共存する", () => {
  const fixture = fileURLToPath(new URL("./fixtures/esnext-stage3-types.ts", import.meta.url));
  for (const lib of ["lib.es5.d.ts", "lib.es2022.d.ts"]) {
    const program = ts.createProgram([fixture], {
      noEmit: true,
      strict: true,
      skipLibCheck: false,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      lib: [lib],
      types: [],
    });
    expect(
      ts
        .getPreEmitDiagnostics(program)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\\n")),
    ).toEqual([]);
  }
});
