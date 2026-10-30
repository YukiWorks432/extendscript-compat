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
  // Node 24の純正toSortedも要素数1の経路で継承プロパティに妨げられるため、正常な実装を明示する。
  runInContext(
    "var nativeFrom = Array.from; Array.prototype.toSorted = function (compare) { return nativeFrom(this).sort(compare); };",
    context,
  );
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
  expect(
    runInContext("Object.getOwnPropertyDescriptor(Array.prototype, '0')", context),
  ).toBeUndefined();
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

it.each(["Array", "Object"])(
  "%s.prototypeの数値プロパティに妨げられず、コピー先に通常の要素を作る",
  (target) => {
    const context = createContext({});
    runInContext(missing, context);
    runInContext(runtime, context);
    for (const descriptor of [
      "{ value: 'inherited', writable: false }",
      "{ get: function () { return 'inherited'; } }",
      "{ set: function () { throw Error('inherited setter'); } }",
    ]) {
      expect(
        runInContext(
          `
      Object.defineProperty(${target}.prototype, '0', Object.assign({ configurable: true }, ${descriptor}));
      var correct;
      try {
        var reversed = [3, 1, 2].toReversed(), sorted = [3, 1, 2].toSorted(), spliced = [3, 1, 2].toSpliced(1, 1, 9);
        var property = Object.getOwnPropertyDescriptor(reversed, '0');
        correct = reversed.join(',') === '2,1,3' && sorted.join(',') === '1,2,3' && spliced.join(',') === '3,9,2' &&
          property.value === 2 && property.writable && property.enumerable && property.configurable;
      } finally { delete ${target}.prototype[0]; }
      correct;
    `,
          context,
        ),
      ).toBe(true);
    }
  },
);

it("旧導入済み印がある配列コピーを更新し、再評価で同一性を保持する", () => {
  const context = createContext({});
  runInContext(
    `
    globalThis.__extendscriptCompatArrayCopy__ = 1;
    ['toReversed', 'toSorted', 'toSpliced'].forEach(function (name) {
      var original = Array.prototype[name];
      Array.prototype[name] = function () {
        var values = original.apply(this, arguments), result = new Array(values.length);
        for (var i = 0; i < values.length; i++) result[i] = values[i];
        return result;
      };
    });
  `,
    context,
  );
  runInContext(runtime, context);
  expect(
    runInContext(
      `
    Object.defineProperty(Array.prototype, '0', { value: 9, writable: false, configurable: true });
    var correct;
    try { correct = [1].toReversed()[0] === 1 && [1].toSorted()[0] === 1 && [1].toSpliced()[0] === 1; }
    finally { delete Array.prototype[0]; }
    correct;
  `,
      context,
    ),
  ).toBe(true);
  runInContext(
    "var refs = [Array.prototype.toReversed, Array.prototype.toSorted, Array.prototype.toSpliced]",
    context,
  );
  runInContext(runtime, context);
  expect(
    runInContext(
      "refs[0] === Array.prototype.toReversed && refs[1] === Array.prototype.toSorted && refs[2] === Array.prototype.toSpliced",
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
