import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { findPrecedenceIssues, protectPrecedence } from "../src/index.js";

it("診断を元コードの文字位置と種類で返す", () => {
  const code = "var result =\n  a ? b : c ? d : e;";
  const diagnostics = findPrecedenceIssues(code);
  expect(diagnostics).toEqual([
    {
      kind: "nested-conditional",
      start: code.indexOf("c ?"),
      end: code.indexOf(";"),
      line: 2,
      column: 10,
    },
  ]);
});

it("呼び出し元のBabel設定が補正処理へ混入しない", () => {
  const previous = process.cwd();
  const directory = mkdtempSync(path.join(os.tmpdir(), "extendscript-compat-"));
  try {
    writeFileSync(
      path.join(directory, "babel.config.json"),
      '{"plugins":["missing-build-plugin"]}',
    );
    process.chdir(directory);
    expect(protectPrecedence("a || b && c").code).toBe("a || (b && c)");
  } finally {
    process.chdir(previous);
    rmSync(directory, { recursive: true });
  }
});
