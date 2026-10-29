import { describe, expect, it } from "vitest";
import { findRegExpRisks } from "../src/index.js";

describe("正規表現の潜在的な互換性問題", () => {
  it.each([
    ["/(aA?|bB?)+$/", ["EC-18"]],
    ["/(a|bB?)+$/", ["EC-18"]],
    ["/(aA?|b)+$/", ["EC-18"]],
    ["/^((a|b)|c)+$/", ["EC-19"]],
    ["/^((a|b)|c)*$/", ["EC-19"]],
    ["/^((a|b)|c){2}$/", ["EC-19"]],
    ["/((a?|b)|c)+/", ["EC-18", "EC-19"]],
  ])("実機で試した構造とその組み合わせ %s を検出する", (pattern, codes) => {
    expect(findRegExpRisks(`var value = ${pattern};`).map(({ code }) => code)).toEqual(codes);
  });

  it.each([
    "/(aA?)+$/",
    "/(a|b|c)+$/",
    "/((a|b)|c)/",
    "/((a|b)|c){1}/",
    "/[()|?+]+/",
    "/\\(a\\|b\\)\\?/",
    "/^((a|b)|c)+$/u",
  ])("対象の構造を持たない、または対象外のリテラル %s は検出しない", (pattern) => {
    expect(findRegExpRisks(`var value = ${pattern};`)).toEqual([]);
  });

  it("コメント、文字列、動的なRegExpをリテラルとして扱わず、位置を入力に対応させる", () => {
    const source = [
      "// /(aA?|bB?)+$/",
      'var text = "/^((a|b)|c)+$/";',
      'var dynamic = new RegExp("(aA?|bB?)+$");',
      "var result = /(a|bB?)+$/;",
      "var result2 = /^((a|b)|c)+$/;",
    ].join("\n");
    const diagnostics = findRegExpRisks(source);
    expect(diagnostics.map(({ code, line, column }) => [code, line, column])).toEqual([
      ["EC-18", 4, 13],
      ["EC-19", 5, 14],
    ]);
    expect(diagnostics.map(({ start, end }) => source.slice(start, end))).toEqual([
      "/(a|bB?)+$/",
      "/^((a|b)|c)+$/",
    ]);
  });
});
