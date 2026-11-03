import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { parse } from "acorn";
import { expect, it } from "vitest";
import { findCompatibilityIssues, protectCompatibility, protectPrecedence } from "../src/index.js";

const cases = JSON.parse(
  readFileSync(new URL("./fixtures/for-initializer-cases.json", import.meta.url), "utf8"),
) as { name: string; code: string; expected: string }[];

it.each(cases)("$name: for初期化部分の補正後も結果を保つ", ({ code, expected }) => {
  expect(runInNewContext(code)).toBe(expected);
  const issues = findCompatibilityIssues(code);
  expect(issues.some(({ kind }) => kind === "for-initializer-in")).toBe(true);
  const result = protectCompatibility(code);
  parse(result.code, { ecmaVersion: 3, allowReserved: "never" });
  expect(runInNewContext(result.code)).toBe(expected);
  expect(findCompatibilityIssues(result.code)).toEqual([]);
  expect(protectCompatibility(result.code).edits).toEqual([]);
  let rebuilt = "",
    cursor = 0;
  for (const edit of result.edits) {
    rebuilt += code.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  expect(rebuilt + code.slice(cursor)).toBe(result.code);
});

it("初期化の外側と文字列・コメント中のinは補正対象にしない", () => {
  const code =
    'var text="in";for(var i=0;"x" in object;i++){/* in */ var yes="x" in object;}for(var key in object){}';
  expect(findCompatibilityIssues(code)).toEqual([]);
  expect(protectCompatibility(code).code).toBe(code);
});

it("診断は元の初期化部分のUTF-16位置を指し、従来の優先順位APIは維持する", () => {
  const code = "var text='😀';\r\nouter:for(var x=('x' in object);x;x--){}";
  const [issue] = findCompatibilityIssues(code);
  expect(issue).toMatchObject({ code: "EC-20", kind: "for-initializer-in", line: 2, column: 10 });
  expect(code.slice(issue.start, issue.end)).toBe("var x=('x' in object)");
  expect(protectPrecedence(code).code).toBe(code);
});

it("字句スコープを変えるlet・constの移動は拒否する", () => {
  for (const kind of ["let", "const"]) {
    expect(() => protectCompatibility(`for(${kind} x=('x' in object);x;){} `)).toThrow(/ES3/);
  }
});

it("初期化部分の既存補正とコメントを同時に保つ", () => {
  const code = String.raw`var out=[];for(var i=("x" in {})?9:(flag || next && last)?0:9, text="\u200c", pattern=/[a\u002Dz]/;i<1;i++){out.push(text.charCodeAt(0),pattern.test("b"));}out.join(",");`;
  const result = protectCompatibility(code);
  expect(runInNewContext(result.code, { flag: true, next: false, last: false })).toBe("8204,false");
  expect(findCompatibilityIssues(result.code)).toEqual([]);
  expect(protectCompatibility(result.code).edits).toEqual([]);
});
