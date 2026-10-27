import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { rollup } from "rollup";
import type { Plugin, OutputChunk, OutputOptions, RollupLog } from "rollup";
import terser from "@rollup/plugin-terser";
import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import { extendscriptCompat } from "../src/rollup.js";
import { assertPrecedenceProtected } from "../src/index.js";

const source = "export var result = a || b && c; export var selected = a ? 10 : b ? 20 : 30;";
async function build(
  input = source,
  plugins: Plugin[] = [],
  output: OutputOptions = {},
  warnings: RollupLog[] = [],
) {
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
      warnings.push(warning);
      if (warning.pluginCode === "EC-03") return;
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
    expect(() => assertPrecedenceProtected(chunk.code)).not.toThrow();
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

  it("外部ソースマップの配信URLと出力サブディレクトリを保持する", async () => {
    const output: OutputOptions = {
      sourcemap: true,
      sourcemapBaseUrl: "https://example.com/maps/",
      sourcemapFileNames: "nested/[name].map",
    };
    const original = await build(source, [], output);
    const protectedOutput = await build(source, [extendscriptCompat()], output);
    const originalChunk = original.output[0] as OutputChunk;
    const protectedChunk = protectedOutput.output[0] as OutputChunk;
    const url = (code: string) => code.match(/sourceMappingURL=([^\r\n]+)/)![1];
    expect(url(protectedChunk.code)).toBe(url(originalChunk.code));
    expect(url(protectedChunk.code)).toMatch(/^https:\/\/example\.com\/maps\//);
    const asset = protectedOutput.output.find(
      (file) => file.fileName === protectedChunk.sourcemapFileName,
    );
    expect(asset?.type === "asset" && asset.source).toBe(protectedChunk.map!.toString());
  });
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

it("EC-03を既定で通知し、選択に応じてビルド停止または通知省略する", async () => {
  const input = "export function run(){for(var i=0;i<3;i++){switch(i){case 1:continue;}return i;}}";
  const warnings: RollupLog[] = [];
  await build(input, [extendscriptCompat()], {}, warnings);
  expect(warnings.filter(({ pluginCode }) => pluginCode === "EC-03")).toHaveLength(1);
  expect(warnings[0].loc?.file).toBe("custom.jsx");
  await expect(build(input, [extendscriptCompat({ diagnostics: "error" })])).rejects.toThrow(
    /continue/,
  );
  const silent: RollupLog[] = [];
  await build(input, [extendscriptCompat({ diagnostics: "off" })], {}, silent);
  expect(silent.filter(({ pluginCode }) => pluginCode === "EC-03")).toEqual([]);
});

it.each([true, "inline", "hidden"] as const)(
  "正規表現の短縮置換と括弧挿入の後もソースマップ %s の位置を保つ",
  async (sourcemap) => {
    const input = String.raw`export var pattern=/[a\u002Dz]/;
export var mark = label || flag && next;`;
    const result = await build(input, [extendscriptCompat()], { sourcemap });
    const chunk = result.output[0] as OutputChunk;
    expect(
      runInNewContext(chunk.code + ";compiled.pattern.test('b')", { label: 0, flag: 0, next: 0 }),
    ).toBe(false);
    for (const token of ["label", "flag", "next"]) {
      const offset = chunk.code.indexOf(token);
      const prefix = chunk.code.slice(0, offset).split("\n");
      const position = originalPositionFor(new TraceMap(chunk.map!.toString()), {
        line: prefix.length,
        column: prefix.at(-1)!.length,
      });
      expect(position.line).toBe(2);
      expect(position.column).toBe(input.split("\n")[1].indexOf(token));
    }
    if (sourcemap === "inline") {
      const encoded = chunk.code.match(/sourceMappingURL=data:[^,]+,([^\r\n]+)/)![1];
      expect(Buffer.from(encoded, "base64").toString()).toBe(chunk.map!.toString());
    } else {
      const map = result.output.find(
        (item) => item.type === "asset" && item.fileName.endsWith(".map"),
      );
      expect(map?.type === "asset" && map.source).toBe(chunk.map!.toString());
    }
  },
);

it("圧縮後の無名continueをラベル付きへ自動補正する", async () => {
  const input =
    "export function run(){var out=[];for(var i=0;i<3;i++){switch(i){case 1:case 2:continue;}out.push(i);}return out.join(',');}";
  const result = await build(input, [terser(), extendscriptCompat()]);
  const chunk = result.output[0] as OutputChunk;
  expect(chunk.code).toMatch(/continue\s+[A-Za-z_$][\w$]*;/);
  expect(runInNewContext(chunk.code + ";compiled.run()")).toBe("0");
});

it("同じ行にある正規表現の短縮後も後続の名前の元位置を保つ", async () => {
  const input = String.raw`export var pattern=/[a\u002Dz]/; export var mark=label || flag && next;`;
  const result = await build(input, [extendscriptCompat()], { sourcemap: true });
  const chunk = result.output[0] as OutputChunk;
  for (const token of ["label", "flag", "next"]) {
    const offset = chunk.code.indexOf(token);
    const prefix = chunk.code.slice(0, offset).split("\n");
    const position = originalPositionFor(new TraceMap(chunk.map!.toString()), {
      line: prefix.length,
      column: prefix.at(-1)!.length,
    });
    expect(position.line).toBe(1);
    expect(position.column).toBe(input.indexOf(token));
  }
});

it.each([true, "inline", "hidden"] as const)(
  "自動ラベル挿入後もソースマップ %s の元位置を保つ",
  async (sourcemap) => {
    const input =
      "export function run(){var marker=0;for(var i=0;i<3;i++){switch(i){case 1:continue;}marker+=i;}return marker;}";
    const result = await build(input, [extendscriptCompat()], { sourcemap });
    const chunk = result.output[0] as OutputChunk;
    expect(runInNewContext(chunk.code + ";compiled.run()")).toBe(2);
    for (const offset of [chunk.code.search(/\bmarker\s*\+=/), chunk.code.lastIndexOf("marker")]) {
      expect(offset).toBeGreaterThan(0);
      const prefix = chunk.code.slice(0, offset).split("\n");
      const position = originalPositionFor(new TraceMap(chunk.map!.toString()), {
        line: prefix.length,
        column: prefix.at(-1)!.length,
      });
      expect(position.line).toBe(1);
      expect(position.column).toBe(
        offset === chunk.code.lastIndexOf("marker")
          ? input.lastIndexOf("marker")
          : input.indexOf("marker+="),
      );
    }
  },
);

it.each([true, "inline", "hidden"] as const)(
  "Unicodeの置換と既存補正の後もソースマップ %s の後続位置を保つ",
  async (sourcemap) => {
    const input = `export var text="${String.fromCharCode(0x200c)}😀"; export var mark=label || flag && next;`;
    const result = await build(input, [extendscriptCompat()], { sourcemap });
    const chunk = result.output[0] as OutputChunk;
    expect(runInNewContext(chunk.code + ";compiled.text", { label: 0, flag: 0, next: 0 })).toBe(
      String.fromCharCode(0x200c) + "😀",
    );
    for (const token of ["label", "flag", "next"]) {
      const offset = chunk.code.indexOf(token);
      const prefix = chunk.code.slice(0, offset).split("\n");
      const position = originalPositionFor(new TraceMap(chunk.map!.toString()), {
        line: prefix.length,
        column: prefix.at(-1)!.length,
      });
      expect(position.line).toBe(1);
      expect(position.column).toBe(input.indexOf(token));
    }
    if (sourcemap === "inline") {
      const encoded = chunk.code.match(/sourceMappingURL=data:[^,]+,([^\r\n]+)/)![1];
      expect(Buffer.from(encoded, "base64").toString()).toBe(chunk.map!.toString());
    } else {
      const map = result.output.find(
        (item) => item.type === "asset" && item.fileName.endsWith(".map"),
      );
      expect(map?.type === "asset" && map.source).toBe(chunk.map!.toString());
    }
  },
);

it("圧縮後と先行includeの文字もUnicode補正し、無変換の識別子は停止する", async () => {
  const value = String.fromCharCode(0x200c, 0x200d, 0xfeff);
  const result = await build(`export var text="${value}😀";`, [
    terser({ format: { ascii_only: false } }),
    extendscriptCompat(),
  ]);
  const chunk = result.output[0] as OutputChunk;
  expect(runInNewContext(chunk.code + ";compiled.text")).toBe(value + "😀");
  expect(chunk.code).not.toMatch(/(?:\u200c|\u200d|\ufeff)/);
  await expect(
    build("export var text=1;", [
      {
        name: "include",
        generateBundle(_options, bundle) {
          for (const chunk of Object.values(bundle))
            if (chunk.type === "chunk") chunk.code += `\nvar x${value[0]}y=1;`;
        },
      },
      extendscriptCompat(),
    ]),
  ).rejects.toThrow(/identifier/);
});

it("先行includeが追加した文字列にもUnicode補正を適用する", async () => {
  const affected = String.fromCharCode(0x200c, 0x200d, 0xfeff);
  const result = await build("export var x=1;", [
    {
      name: "include-unicode",
      generateBundle(_options, bundle) {
        for (const chunk of Object.values(bundle)) {
          if (chunk.type === "chunk") chunk.code += `\nvar included="${affected}";`;
        }
      },
    },
    extendscriptCompat(),
  ]);
  const chunk = result.output[0] as OutputChunk;
  expect(runInNewContext(chunk.code + ";included")).toBe(affected);
  expect(chunk.code).not.toMatch(/(?:\u200c|\u200d|\ufeff)/);
});
