import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("EC-18の実機候補は記録した入力群で標準的な一致とキャプチャに一致する", () => {
  const file = new URL(
    "../docs/evidence/regexp-risks-ae-26.5/ec18-candidate-results.json",
    import.meta.url,
  );
  const { results } = JSON.parse(readFileSync(file, "utf8")) as {
    results: ([string, null] | [string, number, string, string])[];
  };
  expect(results).toHaveLength(156);
  for (const result of results) {
    const input = result[0];
    const match = /(aA?|bB?)+$/.exec(input);
    expect(result).toEqual(match ? [input, match.index, match[0], match[1]] : [input, null]);
  }
});

it("EC-19の実機候補は記録した入力群で標準的な真偽値に一致する", () => {
  const file = new URL(
    "../docs/evidence/regexp-risks-ae-26.5/ec19-candidate-results.json",
    import.meta.url,
  );
  const { results } = JSON.parse(readFileSync(file, "utf8")) as {
    results: [string, boolean, boolean][];
  };
  expect(results).toHaveLength(85);
  let originalMismatches = 0;
  for (const [input, original, candidate] of results) {
    const expected = /^((a|b)|c)+$/.test(input);
    if (original !== expected) originalMismatches++;
    expect(candidate).toBe(expected);
  }
  expect(originalMismatches).toBe(24);
});
