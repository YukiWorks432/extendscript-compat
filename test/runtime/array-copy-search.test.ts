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
  new URL("../contracts/array-copy-search-contract.js", import.meta.url),
  "utf8",
);
const names = ["toSorted", "toReversed", "toSpliced", "findLast", "findLastIndex"];
const missing = names
  .map((name) => "delete Array.prototype[" + JSON.stringify(name) + "];")
  .join("");

it("実機用契約はES3として解析できる", () => {
  expect(() => parse(contract, { ecmaVersion: 3 })).not.toThrow();
});
it("既存版から補完し、再評価で関数を保持する", () => {
  const context = createContext({});
  runInContext(runtime, context);
  runInContext(missing + "delete globalThis.__extendscriptCompatArrayCopy__", context);
  runInContext(runtime, context);
  expect(runInContext(contract, context).failures).toEqual([]);
  const refs = runInContext(
    "[" + names.map((name) => "Array.prototype[" + JSON.stringify(name) + "]").join(",") + "]",
    context,
  );
  runInContext(runtime, context);
  const after = runInContext(
    "[" + names.map((name) => "Array.prototype[" + JSON.stringify(name) + "]").join(",") + "]",
    context,
  );
  expect(after.every((f: unknown, i: number) => f === refs[i])).toBe(true);
});
it("正常な既存関数を保持し、不完全な関数を置換する", () => {
  const context = createContext({});
  const refs = runInContext(
    "[" + names.map((name) => "Array.prototype[" + JSON.stringify(name) + "]").join(",") + "]",
    context,
  );
  runInContext(runtime, context);
  const after = runInContext(
    "[" + names.map((name) => "Array.prototype[" + JSON.stringify(name) + "]").join(",") + "]",
    context,
  );
  expect(after.every((f: unknown, i: number) => f === refs[i])).toBe(true);
  const broken = createContext({});
  runInContext(
    names
      .map((name) => "Array.prototype[" + JSON.stringify(name) + "]=function(){return null;};")
      .join(""),
    broken,
  );
  runInContext(runtime, broken);
  expect(runInContext(contract, broken).failures).toEqual([]);
});
it.each([false, true])("配布出力の圧縮=%sで全契約を満たす", async (minified) => {
  const bundle = await rollup({
    input: runtimePath,
    plugins: [...(minified ? [terser()] : []), extendscriptCompat()],
  });
  try {
    const { output } = await bundle.generate({ format: "iife" });
    if (output[0].type !== "chunk") throw Error("生成チャンクがない");
    const context = createContext({});
    runInContext(missing, context);
    runInContext(output[0].code, context);
    expect(runInContext(contract, context).failures).toEqual([]);
  } finally {
    await bundle.close();
  }
});
it("toSortedは多数の同順位要素を安定して並べ替える", () => {
  const context = createContext({});
  runInContext(missing, context);
  runInContext(runtime, context);
  expect(
    runInContext(
      "var a=[];for(var i=0;i<257;i++)a.push({n:i%5,id:i});var b=a.toSorted(function(x,y){return x.n-y.n;});b.every(function(x,i){return i===0 || b[i-1].n<x.n || (b[i-1].n===x.n && b[i-1].id<x.id);})",
      context,
    ),
  ).toBe(true);
});
it("型宣言はES5とES2023に対応する", () => {
  const fixture = fileURLToPath(new URL("../types/array-copy-search-types.ts", import.meta.url));
  for (const lib of ["lib.es5.d.ts", "lib.es2023.d.ts"]) {
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
