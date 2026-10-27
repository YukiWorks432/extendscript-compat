import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";
import { protectCompatibility, protectUnicode } from "../src/index.js";

const affected = String.fromCharCode(0x200c, 0x200d, 0xfeff);

it("文字列と正規表現の値を保って影響を受ける文字をエスケープする", () => {
  const source = `var value="a${affected}😀z"; var re=/[${affected}]/; [value,re.test(value),re.test("a")];`;
  const before = runInNewContext(source);
  const result = protectUnicode(source);
  const after = runInNewContext(result.code);
  expect(Array.from(after)).toEqual(Array.from(before));
  expect(after[0]).toBe(`a${affected}😀z`);
  expect(after[1]).toBe(true);
  expect(after[2]).toBe(false);
  expect(result.code).not.toMatch(/(?:\u200c|\u200d|\ufeff)/);
  expect(protectUnicode(result.code).edits).toEqual([]);
});

it("直前のバックスラッシュの個数にかかわらず文字列と正規表現の意味を保つ", () => {
  for (let count = 0; count <= 5; count++) {
    const slashes = "\\".repeat(count);
    const value = affected[0];
    const source = `var s="${slashes}${value}"; var r=/${slashes}${value}/; [s,r.source,r.test(s)];`;
    const before = runInNewContext(source);
    const after = runInNewContext(protectUnicode(source).code);
    expect(after[0], `slashes=${count}`).toBe(before[0]);
    expect(after[2], `slashes=${count}`).toBe(before[2]);
  }
});

it("識別子とコメントなどの変換できない箇所は位置を示して停止する", () => {
  for (const source of [
    `var x${affected[0]}y=1;`,
    String.raw`var x\u200cy=1;`,
    `/*! license ${affected[1]} */ var x=1;`,
    `var x=1;${affected[2]}var y=2;`,
  ]) {
    expect(() => protectUnicode(source)).toThrow(/Unicode.* at 1:/);
    expect(() => protectCompatibility(source)).toThrow(/Unicode.* at 1:/);
  }
});

it("既存の互換補正と同時に適用し、繰り返しても変化しない", () => {
  const source = `var text="${affected}"; var r=/[a\\u002Dz${affected[0]}]/; var x=a || b && c;`;
  const result = protectCompatibility(source);
  expect(
    runInNewContext(result.code + ";[text,r.test('-'),r.test(text.charAt(0)),x]", {
      a: false,
      b: true,
      c: 3,
    }),
  ).toEqual([affected, true, true, 3]);
  expect(protectCompatibility(result.code).edits).toEqual([]);
});

it("ディレクティブ文字列も値を保ち、既定の互換補正でUnicodeを変換する", () => {
  const source = `"use${affected[0]}custom"; var text="${affected[1]}"; text;`;
  expect(protectCompatibility(source).code).toBe(protectUnicode(source).code);
  const result = protectUnicode(source);
  expect(runInNewContext(result.code)).toBe(affected[1]);
  expect(result.code).not.toMatch(/(?:\u200c|\u200d|\ufeff)/);
});
