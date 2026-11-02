import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { transformNumberCalls } from "../../../../src/number-transform.js";

const report = JSON.parse(readFileSync(new URL("./comparison.json", import.meta.url), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

for (const { id, input, generatedCodeSha256, sourceMapSha256 } of report.cases) {
  const result = transformNumberCalls(input.code, input.options.source);
  assert.equal(sha256(result.code), generatedCodeSha256, id + ": 生成コード");
  assert.equal(
    sha256(JSON.stringify(JSON.parse(result.map.toString()))),
    sourceMapSha256,
    id + ": ソースマップ",
  );
}

console.log(
  `${report.cases.length}入力の生成コードとソースマップが保存済みの旧版結果と一致しました。`,
);
