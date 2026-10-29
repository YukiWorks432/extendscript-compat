import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { parse } from "acorn";
import { rollup } from "rollup";
import terser from "@rollup/plugin-terser";
import ts from "typescript";
import { extendscriptCompat } from "../../src/rollup.js";
const runtimePath = fileURLToPath(new URL("../../runtime/index.js", import.meta.url));
const runtime = readFileSync(runtimePath, "utf8");
const contract = readFileSync(
  new URL("../contracts/string-modern-contract.js", import.meta.url),
  "utf8",
);
const names = ["replaceAll", "isWellFormed", "toWellFormed"];
const missing = names
  .map((name) => "delete String.prototype[" + JSON.stringify(name) + "];")
  .join("");
const refs =
  "[" + names.map((name) => "String.prototype[" + JSON.stringify(name) + "]").join(",") + "]";
it("共通契約はES3で解析できる", () => {
  expect(() => parse(contract, { ecmaVersion: 3 })).not.toThrow();
});
it("旧版適用後に補完し、再評価で関数を保持する", () => {
  const context = createContext({});
  runInContext(runtime, context);
  runInContext(missing + "delete globalThis.__extendscriptCompatStringModern__", context);
  runInContext(runtime, context);
  expect(runInContext(contract, context).failures).toEqual([]);
  const before = runInContext(refs, context);
  runInContext(runtime, context);
  expect(runInContext(refs, context).every((f: unknown, i: number) => f === before[i])).toBe(true);
});
it("正常な実装は保持し、不完全な実装を置換する", () => {
  const context = createContext({});
  const before = runInContext(refs, context);
  runInContext(runtime, context);
  expect(runInContext(refs, context).every((f: unknown, i: number) => f === before[i])).toBe(true);
  const broken = createContext({});
  runInContext(
    names
      .map((name) => "String.prototype[" + JSON.stringify(name) + "]=function(){return null;};")
      .join(""),
    broken,
  );
  runInContext(runtime, broken);
  expect(runInContext(contract, broken).failures).toEqual([]);
});
it("SymbolがなくflagsもないAE相当の経路で正規表現を扱う", () => {
  const context = createContext({});
  runInContext(runtime, context);
  runInContext(
    missing +
      "delete globalThis.__extendscriptCompatStringModern__;Symbol=undefined;delete RegExp.prototype.flags",
    context,
  );
  runInContext(runtime, context);
  expect(runInContext(contract, context).failures).toEqual([]);
});
it("Symbol.replaceへ元の受信値を渡し、非globalの検査を先に行う", () => {
  const context = createContext({});
  runInContext(missing, context);
  runInContext(runtime, context);
  expect(
    runInContext(
      'var obj={toString:function(){throw Error("coerced");}}, search={};search[Symbol.replace]=function(value,replacement){return value===obj&&replacement===4;};String.prototype.replaceAll.call(obj,search,4)',
      context,
    ),
  ).toBe(true);
  expect(
    runInContext(
      'var called=false, rx=/a/;rx[Symbol.replace]=function(){called=true;};try{"a".replaceAll(rx,"x");}catch(e){}called',
      context,
    ),
  ).toBe(false);
});
it("Symbol.matchの判定と、非関数の置換フックを扱う", () => {
  const context = createContext({});
  runInContext(missing, context);
  runInContext(runtime, context);
  expect(
    runInContext(
      'var search={toString:function(){return "a";}};search[Symbol.match]=false;Object.defineProperty(search,Symbol.toStringTag,{get:function(){throw Error("tag");}});"aa".replaceAll(search,"x")',
      context,
    ),
  ).toBe("xx");
  expect(
    runInContext(
      'var search={};search[Symbol.replace]=3;try{"a".replaceAll(search,"x");false;}catch(e){e instanceof TypeError;}',
      context,
    ),
  ).toBe(true);
});
it.each([false, true])(
  "通常・圧縮の配布出力（圧縮=%s）で契約を満たす",
  async (minified) => {
    const bundle = await rollup({
      input: runtimePath,
      plugins: [...(minified ? [terser()] : []), extendscriptCompat()],
    });
    try {
      const { output } = await bundle.generate({ format: "iife" });
      if (output[0].type !== "chunk") throw Error("生成チャンクなし");
      const context = createContext({});
      runInContext(missing, context);
      runInContext(output[0].code, context);
      expect(runInContext(contract, context).failures).toEqual([]);
    } finally {
      await bundle.close();
    }
  },
  20_000,
);
it("型宣言はES5とES2024の標準ライブラリに対応する", () => {
  const fixture = fileURLToPath(new URL("../types/string-modern-types.ts", import.meta.url));
  for (const lib of ["lib.es5.d.ts", "lib.es2024.d.ts"]) {
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
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    ).toEqual([]);
  }
});
