import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { rollup } from "rollup";
import ts from "typescript";
import terser from "@rollup/plugin-terser";
import { extendscriptCompat } from "../src/rollup.js";

const runtimePath = fileURLToPath(new URL("../runtime/index.js", import.meta.url));
const runtime = readFileSync(runtimePath, "utf8");
const contract = readFileSync(
  new URL("./fixtures/esnext-stage1-contract.js", import.meta.url),
  "utf8",
);
const missing = `
  delete Array.prototype.includes;
  delete String.prototype.padStart;
  delete String.prototype.padEnd;
  delete String.prototype.trimStart;
  delete String.prototype.trimEnd;
  delete String.prototype.trimLeft;
  delete String.prototype.trimRight;
`;

it("旧版の適用済み印があっても新しい機能の契約を満たし、再評価しても関数を保持する", () => {
  const context = createContext({});
  runInContext(missing + "globalThis.__extendscriptCompatPolyfills__ = 1;", context);
  runInContext(runtime, context);
  expect(runInContext(contract, context).failures).toEqual([]);
  runInContext(
    "var refs = [Array.prototype.includes, String.prototype.padStart, String.prototype.trimStart]",
    context,
  );
  runInContext(runtime, context);
  expect(runInContext(contract, context).failures).toEqual([]);
  expect(
    runInContext(
      "refs[0] === Array.prototype.includes && refs[1] === String.prototype.padStart && refs[2] === String.prototype.trimStart",
      context,
    ),
  ).toBe(true);
});

it("不完全な既存関数を補正し、既存の誤った別名を統一する", () => {
  const context = createContext({});
  runInContext(
    `
    Array.prototype.includes = function () { return false; };
    String.prototype.padStart = function () { return "bad"; };
    String.prototype.padEnd = function () { return "bad"; };
    String.prototype.trimStart = function () { return "bad"; };
    String.prototype.trimEnd = function () { return "bad"; };
    String.prototype.trimLeft = function () { return "bad"; };
    String.prototype.trimRight = function () { return "bad"; };
  `,
    context,
  );
  runInContext(runtime, context);
  expect(runInContext(contract, context).failures).toEqual([]);
});

it("正常な組み込み関数を維持し、利用可能な場合は列挙されない属性で追加する", () => {
  const native = createContext({});
  runInContext(
    "var refs = [Array.prototype.includes, String.prototype.padStart, String.prototype.padEnd, String.prototype.trimStart, String.prototype.trimEnd]",
    native,
  );
  runInContext(runtime, native);
  expect(
    runInContext(
      "refs[0] === Array.prototype.includes && refs[1] === String.prototype.padStart && refs[2] === String.prototype.padEnd && refs[3] === String.prototype.trimStart && refs[4] === String.prototype.trimEnd",
      native,
    ),
  ).toBe(true);
  const missingContext = createContext({});
  runInContext(missing, missingContext);
  runInContext(runtime, missingContext);
  expect(
    runInContext(
      "Object.prototype.propertyIsEnumerable.call(Array.prototype, 'includes')",
      missingContext,
    ),
  ).toBe(false);
  expect(
    runInContext(
      "Object.prototype.propertyIsEnumerable.call(String.prototype, 'padStart')",
      missingContext,
    ),
  ).toBe(false);
});

it("属性設定のない環境でも追加できる", () => {
  const context = createContext({});
  runInContext(
    missing + "Object.defineProperty = undefined; globalThis.__extendscriptCompatPolyfills__ = 1;",
    context,
  );
  runInContext(runtime, context);
  expect(runInContext(contract, context).failures).toEqual([]);
  expect(
    runInContext(
      "Object.prototype.propertyIsEnumerable.call(Array.prototype, 'includes')",
      context,
    ),
  ).toBe(true);
});

it.each([false, true])("配布入口から圧縮=%sの出力でも契約を満たす", async (minified) => {
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
  } finally {
    await bundle.close();
  }
});

it("実行時入口の型はES5の型設定でも対応機能のみを公開する", () => {
  const fixture = fileURLToPath(new URL("./fixtures/esnext-stage1-types.ts", import.meta.url));
  const program = ts.createProgram([fixture], {
    noEmit: true,
    strict: true,
    skipLibCheck: false,
    target: ts.ScriptTarget.ES5,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.es5.d.ts"],
    types: [],
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  expect(
    diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")),
  ).toEqual([]);
});

it("ホストのNumberが二進数を読めなくても検索位置と埋め幅を変換する", () => {
  const context = createContext({});
  runInContext(
    missing +
      `
    globalThis.__extendscriptCompatPolyfills__ = 1;
    var nativeNumber = Number;
    Number = function (value) {
      if (typeof value === "string" && /^0[bB]/.test(value)) return NaN;
      return nativeNumber(value);
    };
    Number.prototype = nativeNumber.prototype;
  `,
    context,
  );
  runInContext(runtime, context);
  expect(runInContext('[0, 1, 2].includes(1, "0b10")', context)).toBe(false);
  expect(runInContext('"x".padStart("0b11", "0")', context)).toBe("00x");
});
