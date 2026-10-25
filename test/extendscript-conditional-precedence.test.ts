import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

import {
  assertPrecedenceProtected,
  findPrecedenceIssues,
  protectPrecedence,
} from "../src/index.js";

const evaluate = (source: string, values: Record<string, unknown>) =>
  runInNewContext(source, values);

describe("ExtendScript の入れ子条件式の括弧保護", () => {
  it.each([
    ["true ? 10 : false ? 20 : 30", 10],
    ["false ? 10 : true ? 20 : 30", 20],
    ["false ? 10 : false ? 20 : 30", 30],
    ["true ? true ? 10 : 20 : 30", 10],
    ["true ? false ? 10 : 20 : 30", 20],
    ["(true ? false : true) ? 10 : 20", 20],
    ["false ? 10 : true ? false ? 20 : 30 : 40", 30],
    ["0 ? 10 : 'ready' ? '' : 30", ""],
    ["true || false && false ? 10 : true ? 20 : 30", 10],
  ])("%s の分岐と戻り値を保つ", (source, expected) => {
    const result = protectPrecedence(source);
    expect(evaluate(result.code, {})).toBe(expected);
    expect(findPrecedenceIssues(result.code)).toEqual([]);
    expect(protectPrecedence(result.code).code).toBe(result.code);
  });

  it("偽側の結合順を明示し、単独式と既存の括弧を保持する", () => {
    expect(protectPrecedence("a ? b : c ? d : e").code).toBe("a ? b : (c ? d : e)");
    const source = "a ? b : c; a ? (b ? c : d) : e; (a ? b : c) ? d : e;";
    expect(protectPrecedence(source).code).toBe(source);
  });

  it("引数・条件・アクセサー・更新・後続引数の評価順と回数を保つ", () => {
    const calls: string[] = [];
    let stored = 7;
    const record = {
      get value() {
        calls.push("get");
        return stored;
      },
      set value(value: number) {
        calls.push(`set:${value}`);
        stored = value;
      },
    };
    const source =
      'sink(hit("before", 1), hit("outer", false) ? explode() : hit("inner", true) ? record.value++ : explode(), hit("after", 4))';
    const result = protectPrecedence(source);
    expect(
      evaluate(result.code, {
        record,
        hit(name: string, value: unknown) {
          calls.push(name);
          return value;
        },
        explode() {
          throw new Error("未選択の分岐");
        },
        sink(...values: unknown[]) {
          calls.push("sink");
          return values.join(":");
        },
      }),
    ).toBe("1:7:4");
    expect(stored).toBe(8);
    expect(calls).toEqual(["before", "outer", "inner", "get", "set:8", "after", "sink"]);
  });

  it("選択された分岐の例外を一度だけ伝播する", () => {
    let calls = 0;
    const result = protectPrecedence("false ? 1 : true ? explode() : 2");
    expect(() =>
      evaluate(result.code, {
        explode() {
          calls += 1;
          throw new Error("chosen");
        },
      }),
    ).toThrow("chosen");
    expect(calls).toBe(1);
  });

  it("this・引数の別名更新・直接evalから見える外側の束縛を保つ", () => {
    const source =
      '(function(value) { var closed = 4; var result = true ? false ? 0 : this.base + (arguments[0] += 2) + eval("closed") : 0; return [result, value]; }).call({base: 10}, 3)';
    expect(evaluate(protectPrecedence(source).code, {})).toEqual([19, 5]);
  });

  it("文字列・正規表現・コメント内の条件式らしい文字に触れない", () => {
    const prefix =
      'var text = "a ? b : c ? d : e"; var pattern = /a\\?b:c\\?d:e/; // a ? b : c ? d : e\n';
    expect(protectPrecedence(prefix + "a ? b : c ? d : e").code).toBe(
      prefix + "a ? b : (c ? d : e)",
    );
  });

  it("最終検査が未保護の入れ子を拒否し、括弧付きの入れ子を受け入れる", () => {
    expect(() => assertPrecedenceProtected("a ? b : c ? d : e")).toThrow(
      /unprotected expression precedence/,
    );
    expect(() => assertPrecedenceProtected("a ? b : (c ? d : e)")).not.toThrow();
  });
});
