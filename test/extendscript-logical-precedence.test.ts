import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

import {
  assertExtendscriptExpressionPrecedenceProtected,
  findUnprotectedExtendscriptExpressionPrecedence,
  protectExtendscriptExpressionPrecedence,
} from "../src/index.js";

const evaluate = (source: string, values: Record<string, unknown>) =>
  runInNewContext(source, values);

describe("ExtendScript の論理演算子の優先順位保護", () => {
  it.each([
    [false, false, false],
    [false, false, true],
    [false, true, false],
    [false, true, true],
    [true, false, false],
    [true, false, true],
    [true, true, false],
    [true, true, true],
  ])("真偽値 %s || %s && %s の意味を保つ", (a, b, c) => {
    const source = "a || b && c";
    const expected = a ? a : b ? c : b;
    const result = protectExtendscriptExpressionPrecedence(source);

    expect(result.code).toBe("a || (b && c)");
    expect(evaluate(result.code, { a, b, c })).toBe(expected);
    expect(findUnprotectedExtendscriptExpressionPrecedence(result.code)).toEqual([]);
  });

  it.each([
    [false, false, "fallback"],
    [0, "", 17],
    [null, "ready", 23],
    [undefined, false, "value"],
  ])("論理演算子が返す非真偽値を変えない", (a, b, c) => {
    const result = protectExtendscriptExpressionPrecedence("a || b && c");
    const expected = a ? a : b ? c : b;
    expect(evaluate(result.code, { a, b, c })).toBe(expected);
  });

  it("短絡による値、呼出し順と回数を保つ", () => {
    const source = 'hit("a", true) || hit("b", false) && hit("c", "result")';
    const result = protectExtendscriptExpressionPrecedence(source);
    const calls: string[] = [];
    const value = evaluate(result.code, {
      hit(name: string, returnValue: unknown) {
        calls.push(name);
        return returnValue;
      },
    });

    expect(value).toBe(true);
    expect(calls).toEqual(["a"]);
  });

  it("短絡される例外を評価せず、実行される例外の回数を保つ", () => {
    const source = "true || false && explode()";
    const result = protectExtendscriptExpressionPrecedence(source);
    expect(
      evaluate(result.code, {
        explode: () => {
          throw new Error("called");
        },
      }),
    ).toBe(true);

    const throwing = protectExtendscriptExpressionPrecedence("false || true && explode()");
    expect(() =>
      evaluate(throwing.code, {
        explode: () => {
          throw new Error("called");
        },
      }),
    ).toThrow("called");
  });

  it("両側の優先順位境界を保護し、明示括弧と混在しない演算子列は増やさない", () => {
    const result = protectExtendscriptExpressionPrecedence(
      "a && b || c && d || (e || f) && (g && h)",
    );
    expect(result.code).toBe("(a && b) || (c && d) || ((e || f) && (g && h))");
    expect(protectExtendscriptExpressionPrecedence(result.code).code).toBe(result.code);
  });

  it("文字列・正規表現・コメント内の演算子らしい文字列に触れない", () => {
    const source =
      'var text = "a || b && c"; var pattern = /a\\|\\|b&&c/; // a || b && c\nvar value = a || b && c;';
    const result = protectExtendscriptExpressionPrecedence(source);
    expect(result.code).toContain('var text = "a || b && c";');
    expect(result.code).toContain("var pattern = /a\\|\\|b&&c/;");
    expect(result.code).toContain("// a || b && c");
    expect(result.code).toContain("var value = a || (b && c);");
  });

  it("最終出力検査が未保護の混在式を示し、保護後を受け入れる", () => {
    expect(() => assertExtendscriptExpressionPrecedenceProtected("a || b && c")).toThrow(
      /unprotected expression precedence/,
    );
    expect(() => assertExtendscriptExpressionPrecedenceProtected("a || (b && c)")).not.toThrow();
  });
});
