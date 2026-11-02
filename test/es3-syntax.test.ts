import { expect, it } from "vitest";
import { assertES3Syntax, assertPrecedenceProtected, protectCompatibility } from "../src/index.js";

it.each([
  "",
  'var value = { "default": 1 }; value["default"];',
  'var text = "日本語"; var pattern = /[a-z]+/gim;',
  "\uFEFF// 先頭のBOMとコメントを含む生成物\nvar value = 1;",
  "function choose(a, b) { return a ? (b ? 1 : 2) : 3; }",
  "var layer = app.project.activeItem.layer(1); $.writeln(layer.name);",
])("ES3の生成済みスクリプトを受け入れる: %s", (source) => {
  expect(assertES3Syntax(source)).toBeUndefined();
});

it.each([
  "const value = 1;",
  "let value = 1;",
  "var choose = () => 1;",
  "var value = { get name() { return 1; } };",
  "var value = { name };",
  "var value = object?.name;",
  "export var value = 1;",
  "var value = ;",
  "return 1;",
  "var class = 1;",
  "var value = { default: 1 };",
  "value.default;",
  "#target aftereffects\nvar value = 1;",
  "var value = <item/>;",
])("生成物の対象外構文をSyntaxErrorで拒否する: %s", (source) => {
  expect(() => assertES3Syntax(source)).toThrow(SyntaxError);
});

it("互換補正後のコードを構文と優先順位の両方で検査できる", () => {
  const corrected = protectCompatibility(
    "var result = a || b && c; var choice = a ? b : c ? 1 : 2;",
  );
  assertES3Syntax(corrected.code);
  assertPrecedenceProtected(corrected.code);
});

it("構文検査は実行時APIや優先順位保護を保証しない", () => {
  assertES3Syntax("var value = new Map(); var result = a || b && c;");
});
