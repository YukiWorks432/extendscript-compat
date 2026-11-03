import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { parse } from "acorn";
import { rollup } from "rollup";
import terser from "@rollup/plugin-terser";
import { extendscriptCompat } from "../../src/rollup.js";

const runtimePath = new URL("../../runtime/index.js", import.meta.url);
const runtime = readFileSync(runtimePath, "utf8");
const legacy = readFileSync(new URL("../fixtures/json2-legacy.js", import.meta.url), "utf8");
const contract = readFileSync(
  new URL("../contracts/json-parse-contract.js", import.meta.url),
  "utf8",
);

// プロパティ記述子を持つ環境でも、reviverによる変更不可化を標準と同じく扱う。
const immutableReviver = `(function () {
  function revive(key, value) {
    if (key === "keep" || key === "0") { Object.freeze(this); return 3; }
    if (key === "remove" || key === "1") return undefined;
    return value;
  }
  var object = JSON.parse('{"keep":1,"remove":2}', revive);
  var array = JSON.parse('[1,2]', revive);
  return [object.keep, object.remove, array[0], array[1]];
}())`;

it("JSON.parseの共用契約はES3で解析でき、独立した標準実装と一致する", () => {
  parse(contract, { ecmaVersion: 3, allowReserved: "never" });
  expect(runInContext(contract, createContext({})).failures).toEqual([]);
  expect(runInContext(immutableReviver, createContext({}))).toEqual([1, 2, 1, 2]);
});

it.each([false, true])("圧縮=%sの利用側出力でJSON文法とreviverを保証する", async (minified) => {
  const bundle = await rollup({
    input: fileURLToPath(runtimePath),
    plugins: [...(minified ? [terser({ ie8: true })] : []), extendscriptCompat()],
  });
  try {
    const { output } = await bundle.generate({ format: "iife" });
    if (output[0].type !== "chunk") throw new Error("生成チャンクがない");
    const context = createContext({});
    runInContext("JSON = undefined", context);
    runInContext(output[0].code, context);
    expect(runInContext(contract, context).failures).toEqual([]);
    expect(runInContext(immutableReviver, context)).toEqual([1, 2, 1, 2]);
  } finally {
    await bundle.close();
  }
});

it("0.4.0のJSON導入済み印があっても、旧json2の解析を更新する", () => {
  const context = createContext({});
  runInContext("JSON = undefined", context);
  runInContext(legacy, context);
  // 公開済み0.4.0が書き込む印。更新前に無効なJSONを受理する状態を再現する。
  runInContext(
    "globalThis.__extendscriptCompatJSON__ = 1; var previousParse = JSON.parse",
    context,
  );
  expect(runInContext('JSON.parse("[1,]").length', context)).toBe(1);
  runInContext(runtime, context);
  expect(runInContext(contract, context).failures).toEqual([]);
  expect(runInContext("previousParse === JSON.parse", context)).toBe(false);
  runInContext("var updatedParse = JSON.parse, updatedStringify = JSON.stringify", context);
  runInContext(runtime, context);
  runInContext(legacy, context);
  expect(
    runInContext("updatedParse === JSON.parse && updatedStringify === JSON.stringify", context),
  ).toBe(true);
  expect(runInContext(contract, context).failures).toEqual([]);
});

it("文法とreviverを満たす既存のJSON関数を保持する", () => {
  const context = createContext({});
  runInContext("var previousParse = JSON.parse, previousStringify = JSON.stringify", context);
  runInContext(runtime, context);
  expect(
    runInContext("previousParse === JSON.parse && previousStringify === JSON.stringify", context),
  ).toBe(true);
});

it("既存の解析を置き換えても、正常なstringifyは保持する", () => {
  const context = createContext({});
  runInContext("var stringify = JSON.stringify; JSON.parse = undefined", context);
  runInContext(legacy, context);
  runInContext(runtime, context);
  expect(runInContext("stringify === JSON.stringify", context)).toBe(true);
  expect(runInContext(contract, context).failures).toEqual([]);
});
