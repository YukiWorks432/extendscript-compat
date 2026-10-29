import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { rollup } from "rollup";
import terser from "@rollup/plugin-terser";
import { assertPrecedenceProtected } from "../src/index.js";
import { extendscriptCompat } from "../src/rollup.js";

const runtimePath = fileURLToPath(new URL("../runtime/index.js", import.meta.url));
const runtime = readFileSync(runtimePath, "utf8");
const contract = readFileSync(new URL("./contracts/runtime-contract.js", import.meta.url), "utf8");

it("上書きした公開関数の戻り値・型変換・副作用を独立した期待値で検証する", () => {
  const context = createContext({});
  runInContext(runtime, context);
  const report = runInContext(contract, context);
  expect(report.failures).toEqual([]);
  expect(report.passed).toBe(report.total);
});

it("実機で観測した4種類の不具合がある関数も、存在確認で省略せず修正する", () => {
  const context = createContext({});
  runInContext(
    String.raw`var nativeParseInt = parseInt;
var nativeCharAt = String.prototype.charAt;
var nativeSplit = String.prototype.split;
var nativeReplace = String.prototype.replace;
parseInt = function (text, radix) {
  if (String(text) === "a?" && Number(radix) === 16) return 175;
  return nativeParseInt(text, radix);
};
String.prototype.charAt = function (position) {
  var result = nativeCharAt.call(this, position);
  return result === "\0" ? "" : result;
};
String.prototype.split = function (separator, limit) {
  var result = nativeSplit.call(this, separator, limit);
  if (separator instanceof RegExp && result[result.length - 1] === "") result.pop();
  return result;
};
String.prototype.replace = function (search, replacement) {
  if (String(this) === "b" && replacement === "$1$2") return "undefinedb";
  return nativeReplace.call(this, search, replacement);
};
function observed() {
  return [parseInt("a?",16), "x\0y".charAt(1).length,
    "ab".split(/b/).length, "b".replace(/(a)|(b)/,"$1$2")];
}`,
    context,
  );
  expect(runInContext("observed()", context)).toEqual([175, 0, 1, "undefinedb"]);
  runInContext(runtime, context);
  expect(runInContext("observed()", context)).toEqual([10, 1, 2, "b"]);
});

it("同じエンジンで再評価しても関数を重ねて包まず、省略基数の挙動を保つ", () => {
  const context = createContext({});
  const baseline = runInContext('[parseInt("010"),parseInt("08"),parseInt("-0")]', context);
  runInContext(runtime, context);
  runInContext(
    "var installed = [parseInt,String.prototype.charAt,String.prototype.split,String.prototype.replace]",
    context,
  );
  runInContext(runtime, context);
  expect(
    runInContext(
      "installed[0]===parseInt && installed[1]===String.prototype.charAt && installed[2]===String.prototype.split && installed[3]===String.prototype.replace",
      context,
    ),
  ).toBe(true);
  expect(runInContext('[parseInt("010"),parseInt("08"),parseInt("-0")]', context)).toEqual(
    baseline,
  );
});

it("配布する実行時コード自身の優先順位を保護し、公開入口を解決できる", () => {
  expect(() => assertPrecedenceProtected(runtime)).not.toThrow();
  expect(import.meta.resolve("extendscript-compat/runtime")).toBe(
    new URL("../runtime/index.js", import.meta.url).href,
  );
});

it("実際に圧縮・補正したバンドルでも4関数の契約と再評価を保つ", async () => {
  const bundle = await rollup({
    input: "runtime-entry",
    plugins: [
      {
        name: "fixture",
        resolveId(id) {
          if (id === "runtime-entry") return id;
          if (id === "extendscript-compat/runtime") return runtimePath;
        },
        load(id) {
          if (id === "runtime-entry") return 'import "extendscript-compat/runtime";';
        },
      },
      terser({ format: { comments: /^!/ } }),
      extendscriptCompat(),
    ],
  });
  try {
    const generated = await bundle.generate({ format: "iife" });
    const chunk = generated.output[0];
    expect(chunk.type).toBe("chunk");
    if (chunk.type !== "chunk") throw new Error("生成チャンクがない");
    assertPrecedenceProtected(chunk.code);
    const context = createContext({});
    runInContext(chunk.code, context);
    expect(runInContext(contract, context).failures).toEqual([]);
    runInContext(chunk.code, context);
    expect(runInContext(contract, context).failures).toEqual([]);
  } finally {
    await bundle.close();
  }
});

it("AEが省略するglobal置換の末尾空一致を一度だけ補う", () => {
  const context = createContext({});
  runInContext(
    String.raw`var nativeReplace = String.prototype.replace;
String.prototype.replace = function (search, replacement) {
  var string = String(this);
  if (search instanceof RegExp && search.global && typeof replacement === "function") {
    return nativeReplace.call(string, search, function (match) {
      var position = arguments[arguments.length - 2];
      if (match === "" && position === string.length) return match;
      return replacement.apply(this, arguments);
    });
  }
  return nativeReplace.call(string, search, replacement);
};`,
    context,
  );
  expect(runInContext('"ab".replace(/(?:)/g, function () { return "-"; })', context)).toBe("-a-b");
  runInContext(runtime, context);
  expect(runInContext('"ab".replace(/(?:)/g, "-")', context)).toBe("-a-b-");
  expect(runInContext('"ab".replace(/^/g, "-")', context)).toBe("-ab");
  expect(runInContext('"ab".replace(/$/g, "-")', context)).toBe("ab-");
});
