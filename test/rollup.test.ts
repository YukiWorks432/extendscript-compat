import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { rollup } from "rollup";
import type { Plugin, OutputChunk, OutputOptions } from "rollup";
import terser from "@rollup/plugin-terser";
import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import { extendscriptCompat } from "../src/rollup.js";
import { assertExtendscriptExpressionPrecedenceProtected } from "../src/index.js";

const source = "export var result = a || b && c; export var selected = a ? 10 : b ? 20 : 30;";
async function build(input = source, plugins: Plugin[] = [], output: OutputOptions = {}) {
  const bundle = await rollup({
    input: "fixture.js",
    plugins: [
      {
        name: "fixture",
        resolveId: (id) => (id === "fixture.js" ? id : null),
        load: (id) => (id === "fixture.js" ? input : null),
      },
      ...plugins,
    ],
    onwarn(warning, defaultHandler) {
      if (warning.code !== "MISSING_GLOBAL_NAME") defaultHandler(warning);
    },
  });
  try {
    return await bundle.generate({
      format: "iife",
      name: "compiled",
      file: "custom.jsx",
      ...output,
    });
  } finally {
    await bundle.close();
  }
}

describe("Rollupで生成した最終コードの保護", () => {
  it("出力名に依存せず、圧縮後の分岐と短絡評価を保つ", async () => {
    const result = await build(source, [terser(), extendscriptCompat()]);
    const chunk = result.output[0] as OutputChunk;
    expect(chunk.fileName).toBe("custom.jsx");
    expect(() => assertExtendscriptExpressionPrecedenceProtected(chunk.code)).not.toThrow();
    for (const [a, b, c, value, selected] of [
      [true, false, false, true, 10],
      [false, true, 7, 7, 20],
      [false, false, 7, false, 30],
    ]) {
      const actual = runInNewContext(chunk.code + ";compiled", { a, b, c });
      expect(actual.result).toBe(value);
      expect(actual.selected).toBe(selected);
    }
    // JavaScriptの生成器が省略できる括弧を、圧縮後の成果物で保証する。
    expect(chunk.code).toMatch(/:\([^()]*\?[^()]*:[^()]*\)/);
  });

  it("先行するgenerateBundleで追加されたコードにも適用する", async () => {
    const result = await build("export var value = 1;", [
      {
        name: "include",
        generateBundle(_options, bundle) {
          for (const chunk of Object.values(bundle)) {
            if (chunk.type === "chunk") chunk.code += "\nvar included = a ? b : c ? d : e;";
          }
        },
      },
      extendscriptCompat(),
    ]);
    const chunk = result.output[0] as OutputChunk;
    expect(chunk.code).toContain("var included = a ? b : (c ? d : e);");
  });

  it.each([true, "inline", "hidden"] as const)(
    "ソースマップ %s の元ファイル・行・列を括弧挿入後も保持する",
    async (sourcemap) => {
      const result = await build(source, [extendscriptCompat()], { sourcemap });
      const chunk = result.output[0] as OutputChunk;
      const offset = chunk.code.indexOf("b && c");
      expect(offset).toBeGreaterThan(0);
      const prefix = chunk.code.slice(0, offset).split("\n");
      const position = originalPositionFor(new TraceMap(chunk.map!.toString()), {
        line: prefix.length,
        column: prefix.at(-1)!.length,
      });
      expect(position.source).toMatch(/fixture\.js$/);
      expect(position.line).toBe(1);
      expect(position.column).toBe(source.indexOf("b && c"));
      const serialized = chunk.map!.toString();
      if (sourcemap === "inline") {
        const encoded = chunk.code.match(/sourceMappingURL=data:[^,]+,([^\r\n]+)/)![1];
        expect(Buffer.from(encoded, "base64").toString()).toBe(serialized);
      } else {
        const asset = result.output.find(
          (file) => file.type === "asset" && file.fileName.endsWith(".map"),
        );
        expect(asset?.type === "asset" && asset.source).toBe(serialized);
        expect(chunk.code.includes("sourceMappingURL=")).toBe(sourcemap !== "hidden");
      }
    },
  );

  it("構文エラーがあるコードを成功した成果物として出力しない", async () => {
    await expect(
      build("export var value = 1;", [
        {
          name: "broken-code",
          generateBundle(_options, bundle) {
            for (const chunk of Object.values(bundle)) {
              if (chunk.type === "chunk") chunk.code += "\nvar = ;";
            }
          },
        },
        extendscriptCompat(),
      ]),
    ).rejects.toThrow();
  });
});
