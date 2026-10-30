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
  new URL("../contracts/json-stringify-contract.js", import.meta.url),
  "utf8",
);

it("JSONの契約はES3で解析でき、標準実装が期待値を満たす", () => {
  expect(() => parse(contract, { ecmaVersion: 3 })).not.toThrow();
  expect(runInContext(contract, createContext({})).failures).toEqual([]);
});

it.each([false, true])("圧縮=%sの配布ランタイムでJSONの契約を満たす", async (minified) => {
  const bundle = await rollup({
    input: fileURLToPath(runtimePath),
    plugins: [...(minified ? [terser()] : []), extendscriptCompat()],
  });
  try {
    const { output } = await bundle.generate({ format: "iife" });
    if (output[0].type !== "chunk") throw new Error("生成チャンクがない");
    const context = createContext({});
    runInContext("JSON = undefined", context);
    runInContext(output[0].code, context);
    expect(runInContext(contract, context).failures).toEqual([]);
  } finally {
    await bundle.close();
  }
});

it("旧json2と既存の導入済み印があっても更新し、再評価では関数を保持する", () => {
  const context = createContext({});
  runInContext("JSON = undefined", context);
  runInContext(legacy, context);
  runInContext(
    "globalThis.__extendscriptCompatPolyfills__ = 1; var oldParse = JSON.parse;",
    context,
  );
  runInContext(runtime, context);
  expect(runInContext(contract, context).failures).toEqual([]);
  expect(runInContext("oldParse === JSON.parse", context)).toBe(true);
  runInContext("var updated = JSON.stringify", context);
  runInContext(runtime, context);
  expect(runInContext("updated === JSON.stringify", context)).toBe(true);
  runInContext(legacy, context);
  expect(runInContext(contract, context).failures).toEqual([]);
});

it("正常な既存JSON関数を保持する", () => {
  const context = createContext({});
  runInContext("var originalParse = JSON.parse, originalStringify = JSON.stringify", context);
  runInContext(runtime, context);
  expect(
    runInContext("originalParse === JSON.parse && originalStringify === JSON.stringify", context),
  ).toBe(true);
});

it("キー一覧を満たさない既存のstringifyを置換する", () => {
  const context = createContext({});
  runInContext(
    `var original = JSON.stringify;
    JSON.stringify = function (value, replacer, space) {
      return original(value, Array.isArray(replacer) ? ["1", "2"] : replacer, space);
    };`,
    context,
  );
  runInContext(runtime, context);
  expect(runInContext(contract, context).failures).toEqual([]);
});
