import { runInNewContext } from "node:vm";
import { parse } from "acorn";
import { rollup } from "rollup";
import terser from "@rollup/plugin-terser";
import { expect, it } from "vitest";
import { extendscriptCompat } from "../src/rollup.js";
import { toNumber } from "../runtime/number.js";
import { run as runHostContract } from "./fixtures/number-host-contract.js";

it("数値変換の入力を標準の結果へ変換し、グローバルは変更しない", () => {
  const original = globalThis.Number;
  const cases: [unknown, number][] = [
    [undefined, NaN],
    [null, 0],
    [true, 1],
    [false, 0],
    [0, 0],
    [-0, -0],
    [42, 42],
    ["", 0],
    [" \t\n", 0],
    ["0b101", 5],
    ["0B101", 5],
    ["0o10", 8],
    ["0O17", 15],
    ["0x10", 16],
    ["+0x10", NaN],
    ["-0b1", NaN],
    ["0b2", NaN],
    ["0o8", NaN],
    ["0b", NaN],
    ["12x", NaN],
    ["  -0  ", -0],
    ["-.5e+2", -50],
    ["Infinity", Infinity],
    ["-Infinity", -Infinity],
    ["+Infinity", Infinity],
    [String.fromCharCode(0x200b) + "0", NaN],
    ["0" + String.fromCharCode(0x180e), NaN],
    [String.fromCharCode(0xfeff, 0x1680) + "0b101" + String.fromCharCode(0x200a, 0x2029), 5],
  ];
  expect(toNumber()).toBe(0);
  for (const [input, expected] of cases) expect(toNumber(input), String(input)).toBe(expected);
  expect(globalThis.Number).toBe(original);
});

it("オブジェクトの変換順序を保ち、各メソッドを必要な回数だけ呼ぶ", () => {
  const calls: string[] = [];
  const value = {
    valueOf() {
      calls.push("valueOf");
      return {};
    },
    toString() {
      calls.push("toString");
      return "0b101";
    },
  };
  expect(toNumber(value)).toBe(5);
  expect(calls).toEqual(["valueOf", "toString"]);
  const error = new Error("valueOf failed");
  expect(() =>
    toNumber({
      valueOf() {
        throw error;
      },
    }),
  ).toThrow(error);
  expect(() =>
    toNumber({
      valueOf() {
        return {};
      },
      toString() {
        return {};
      },
    }),
  ).toThrow(TypeError);
});

it("Symbol.toPrimitiveがある場合はnumberヒントを一度だけ渡す", () => {
  const calls: string[] = [];
  const value = {
    [Symbol.toPrimitive](hint: string) {
      calls.push(hint);
      return "0o11";
    },
  };
  expect(toNumber(value)).toBe(9);
  expect(calls).toEqual(["number"]);
  expect(() =>
    toNumber({
      [Symbol.toPrimitive]() {
        return {};
      },
    }),
  ).toThrow(TypeError);
});

it("ネイティブNumberを変更せず、文字列表記を全体として検証する", () => {
  for (const input of [
    "0b10x",
    "0o19",
    "1_000",
    "NaN",
    "1e",
    "1 2",
    ".",
    "0x1z",
    "-0x1",
    "0b 1",
    "0b01\u200c",
  ]) {
    expect(Number.isNaN(toNumber(input)), input).toBe(true);
  }
  for (const input of [
    "1e100",
    ".5",
    "1.",
    "0xFF",
    "0b111111111111111111111111111111111111111111111111111111",
    "0o77777777777777777777",
  ]) {
    expect(toNumber(input), input).toBe(Number(input));
  }
});

it("実機と共有する契約資料を通常のJavaScriptでも実行する", () => {
  const result = runHostContract();
  expect(result.failures).toEqual([]);
  expect(result.passed).toBe(result.total);
});

it.each([false, true])("通常版・圧縮版 %s がES3構文で同じ変換契約を満たす", async (compressed) => {
  const bundle = await rollup({
    input: "test/fixtures/number-host-contract.js",
    plugins: [
      ...(compressed ? [terser({ format: { ascii_only: true, ecma: 5 } })] : []),
      extendscriptCompat(),
    ],
  });
  try {
    const result = await bundle.generate({
      format: "iife",
      name: "numberProbe",
      footer: "numberProbe.run();",
    });
    const chunk = result.output.find((item) => item.type === "chunk");
    expect(chunk).toBeDefined();
    parse(chunk!.code, { ecmaVersion: 3 });
    const actual = runInNewContext(chunk!.code);
    expect(actual.failures).toEqual([]);
    expect(actual.passed).toBe(actual.total);
  } finally {
    await bundle.close();
  }
});

it("規格上の空白と非空白を区別し、値の変換を一度だけ行う", () => {
  const whitespace = [
    9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201,
    8202, 8232, 8233, 8239, 8287, 12288, 65279,
  ];
  for (const code of whitespace) {
    const c = String.fromCharCode(code);
    expect(toNumber(c + "0b101" + c), code.toString(16)).toBe(5);
  }
  for (const code of [0x85, 0x180e, 0x200b, 0x200c, 0x200d, 0xfffe]) {
    const c = String.fromCharCode(code);
    expect(Number.isNaN(toNumber(c + "0")), code.toString(16)).toBe(true);
  }
  let accesses = 0;
  const value = Object.defineProperty({}, "valueOf", {
    get() {
      accesses++;
      return () => "0o11";
    },
  });
  expect(toNumber(value)).toBe(9);
  expect(accesses).toBe(1);
});
