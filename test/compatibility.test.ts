import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";
import { findCompatibilityIssues, protectCompatibility, protectPrecedence } from "../src/index.js";

it("switchから最も内側のループへ抜ける無名continueを検出して補正する", () => {
  const source = [
    "outer: for(var i=0;i<3;i++){",
    " switch(i){",
    " case 0: continue;",
    " case 1: for(var j=0;j<2;j++){continue;} break;",
    " default: continue outer;",
    " }",
    "}",
    "while(ready){switch(value){case 0:switch(other){default:continue;}}}",
    "do{switch(value){default:continue;}}while(ready);",
  ].join("\n");
  const diagnostics = findCompatibilityIssues(source);
  expect(diagnostics.map(({ code, line }) => [code, line])).toEqual([
    ["EC-03", 3],
    ["EC-03", 8],
    ["EC-03", 9],
  ]);
  for (const diagnostic of diagnostics)
    expect(source.slice(diagnostic.start, diagnostic.end)).toBe("continue;");
  const result = protectCompatibility(source);
  expect(findCompatibilityIssues(result.code)).toEqual([]);
  expect(result.diagnostics).toEqual(diagnostics);
});

it("関数内の別ループやswitch内のループに属するcontinueは誤検出しない", () => {
  expect(
    findCompatibilityIssues(
      "for(;;){switch(x){default:(function(){while(x){continue;}})();while(y){continue;}break;}}",
    ),
  ).toEqual([]);
});

it("文字クラスのハイフンだけを補正し、文字列・コメント・外側のエスケープは保つ", () => {
  const source = String.raw`var text="[a\\x2Dz]"; // [a\x2Dz]
var p=/[a\x2Dz]/; var q=/[^a\u002dz]/; var outside=/\x2D/;
var escaped=/[a\\x2Dz]/; var bracket=/\[a\x2Dz/;`;
  const result = protectCompatibility(source);
  expect(result.edits).toHaveLength(2);
  expect(result.diagnostics).toEqual([]);
  expect(result.code).toContain(String.raw`var p=/[a\-z]/; var q=/[^a\-z]/;`);
  expect(result.code).toContain(String.raw`var outside=/\x2D/;`);
  expect(result.code).toContain(String.raw`var escaped=/[a\\x2Dz]/;`);
  expect(result.code).toContain(String.raw`var bracket=/\[a\x2Dz/;`);
  expect(result.code.split("\n")[0]).toBe(source.split("\n")[0]);
  expect(protectCompatibility(result.code).edits).toEqual([]);
});

it("通常JavaScriptで文字集合・否定・範囲端点の意味を維持する", () => {
  const patterns = [
    String.raw`[a\x2Dz]`,
    String.raw`[^a\u002Dz]`,
    String.raw`[\x2D-a]`,
    String.raw`[+\x2D-z]`,
    String.raw`[\x2D-\u002D]`,
    String.raw`[\x2D]`,
    String.raw`[a\]b\x2Dz]`,
    String.raw`[[]\x2D`,
    String.raw`[\\x2D]`,
  ];
  for (const pattern of patterns) {
    const source = "var pattern=/" + pattern + "/; pattern;";
    const before = runInNewContext(source) as RegExp;
    const after = runInNewContext(protectCompatibility(source).code) as RegExp;
    for (let code = 0; code < 256; code++) {
      const text = String.fromCharCode(code);
      expect(after.test(text), pattern + " / " + code).toBe(before.test(text));
    }
  }
});

it("ES3以外の正規表現フラグと動的コンストラクタは補正範囲へ混ぜない", () => {
  const source = String.raw`var p=/[a\x2Dz]/u; var dynamic=new RegExp("[a\\x2Dz]");`;
  expect(protectCompatibility(source).code).toBe(source);
});

it("既存の括弧だけのAPIを維持し、統合APIでは位置順に挿入と置換を返す", () => {
  const source = String.raw`var result=a || /[a\x2Dz]/.test(text) && value;`;
  expect(protectPrecedence(source).code).toBe(
    String.raw`var result=a || (/[a\x2Dz]/.test(text) && value);`,
  );
  const result = protectCompatibility(source);
  expect(result.code).toBe(String.raw`var result=a || (/[a\-z]/.test(text) && value);`);
  expect(runInNewContext(result.code + "result", { a: false, text: "b", value: 7 })).toBe(false);
  expect(runInNewContext(result.code + "result", { a: false, text: "-", value: 7 })).toBe(7);
  let cursor = 0,
    rebuilt = "";
  for (const edit of result.edits) {
    rebuilt += source.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  expect(rebuilt + source.slice(cursor)).toBe(result.code);
  expect(protectCompatibility(result.code).code).toBe(result.code);
});

it("診断の文字位置と行・列が改行形式とUTF-16文字を含む入力を指す", () => {
  const source = "var text='😀';\r\n  var pattern=/[a\\u002Dz]/;";
  const diagnostic = findCompatibilityIssues(source)[0];
  expect(diagnostic.code).toBe("EC-06");
  expect(diagnostic.line).toBe(2);
  expect(diagnostic.column).toBe(17);
  expect(source.slice(diagnostic.start, diagnostic.end)).toBe(String.raw`\u002D`);
});

it("ラベル付きcontinueの省略セミコロンを圧縮後へ戻し、回避策を実行可能にする", () => {
  const source =
    "var n=[];outer:for(var i=0;i<3;i++){switch(i){case 1:case 2:continue outer}n.push(i)}n.join(',')";
  const diagnostics = findCompatibilityIssues(source);
  expect(diagnostics.map(({ kind }) => kind)).toEqual(["labeled-continue-semicolon"]);
  const result = protectCompatibility(source);
  expect(result.diagnostics).toEqual([]);
  expect(result.code).toContain("continue outer;");
  expect(runInNewContext(result.code)).toBe("0");
  expect(protectCompatibility(result.code).edits).toEqual([]);
});

const continueCases = JSON.parse(
  readFileSync(new URL("./fixtures/continue-cases.json", import.meta.url), "utf8"),
) as { name: string; code: string; expected: string }[];

it.each(continueCases)("EC-03を自動補正して$nameを保つ", ({ code, expected }) => {
  expect(runInNewContext(code)).toBe(expected);
  const result = protectCompatibility(code);
  expect(runInNewContext(result.code)).toBe(expected);
  expect(findCompatibilityIssues(result.code)).toEqual([]);
  expect(protectCompatibility(result.code).edits).toEqual([]);
});

it("既存のループラベルとコメントを保ち、生成するラベルは同じループで共有する", () => {
  const code = "outer:for(var i=0;i<3;i++){switch(i){case 1:continue /*keep*/;case 2:continue;}}";
  const result = protectCompatibility(code);
  expect(result.code).toContain("continue outer /*keep*/;");
  expect(result.code).toContain("continue outer;");
  expect(result.code.match(/outer:/g)).toHaveLength(1);
  expect(result.diagnostics).toHaveLength(2);
});
