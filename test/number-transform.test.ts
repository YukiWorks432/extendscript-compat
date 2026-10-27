import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";
import { rollup } from "rollup";
import type { OutputChunk, OutputOptions, Plugin, RollupLog } from "rollup";
import terser from "@rollup/plugin-terser";
import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import { expect, it } from "vitest";
import { extendscriptCompat } from "../src/rollup.js";

async function build(
  input: string,
  compressed = false,
  output: OutputOptions = {},
  warnings: RollupLog[] = [],
  diagnostics: "warn" | "error" | "off" = "warn",
) {
  const sourcePlugin: Plugin = {
    name: "fixture",
    resolveId: (id) => (id === "fixture.js" ? id : null),
    load: (id) => (id === "fixture.js" ? input : null),
  };
  const bundle = await rollup({
    input: "fixture.js",
    plugins: [sourcePlugin, ...(compressed ? [terser()] : []), extendscriptCompat({ diagnostics })],
    onwarn(warning, defaultHandler) {
      warnings.push(warning);
      if (warning.pluginCode !== "NUMBER_UNSUPPORTED") defaultHandler(warning);
    },
  });
  try {
    return await bundle.generate({
      format: "iife",
      name: "compiled",
      file: "script.jsx",
      ...output,
    });
  } finally {
    await bundle.close();
  }
}

function aeNumber(value?: unknown) {
  if (value === "0b101" || value === "0o10") return NaN;
  return arguments.length === 0 ? 0 : Number(value);
}

it.each([false, true])(
  "標準プラグインでNumberの直接呼び出しを補正する 圧縮=%s",
  async (compressed) => {
    const input = `export function run(){
    var seen=[];
    function record(x){seen.push(x);return x;}
    var a=Number(record("0b101"),record("extra"));
    var b=Number("0o10");
    var c=Number();
    var d=Number(void 0);
    return [a,b,c,d,seen.join(",")];
  }`;
    const output = await build(input, compressed);
    const chunk = output.output[0] as OutputChunk;
    const result = runInNewContext(chunk.code + ";compiled.run()", { Number: aeNumber });
    expect(Array.from(result)).toEqual([5, 8, 0, NaN, "0b101,extra"]);
  },
);

it("ローカルのNumberやメソッドを誤って書き換えず、名前衝突を避ける", async () => {
  const source = `export function run(){
    var __extendscriptCompatToNumber=77;
    function local(Number){return Number("0b101");}
    var object={Number:function(x){return "property:"+x;}};
    return [Number("0b101"),local(function(x){return "local:"+x;}),object.Number("0b101"),__extendscriptCompatToNumber];
  }`;
  const result = await build(source);
  const chunk = result.output[0] as OutputChunk;
  expect(Array.from(runInNewContext(chunk.code + ";compiled.run()", { Number: aeNumber }))).toEqual(
    [5, "local:0b101", "property:0b101", 77],
  );
});

it("new Numberと別名・静的メソッドを変更しない", async () => {
  const source = `export function run(){var alias=Number; return [new Number(7).valueOf(),alias("42"),Number.parseInt("11",10)];}`;
  const output = await build(source);
  const chunk = output.output[0] as OutputChunk;
  expect(Array.from(runInNewContext(chunk.code + ";compiled.run()"))).toEqual([7, 42, 11]);
});

it.each([true, "inline", "hidden"] as const)(
  "ソースマップ %s が変換後の後続参照を元の位置に戻す",
  async (sourcemap) => {
    const source = `export function run(input){return flag || Number(input) && marker;}`;
    const output = await build(source, false, { sourcemap });
    const chunk = output.output[0] as OutputChunk;
    const offset = chunk.code.lastIndexOf("marker");
    expect(offset).toBeGreaterThan(0);
    const prefix = chunk.code.slice(0, offset).split("\n");
    const mapped = originalPositionFor(new TraceMap(chunk.map!.toString()), {
      line: prefix.length,
      column: prefix.at(-1)!.length,
    });
    expect(mapped.source).toMatch(/fixture\.js$/);
    expect(mapped.line).toBe(1);
    expect(mapped.column).toBe(source.indexOf("marker"));
    if (sourcemap === "inline") {
      const encoded = chunk.code.match(/sourceMappingURL=data:[^,]+,([^\r\n]+)/)![1];
      expect(Buffer.from(encoded, "base64").toString()).toBe(chunk.map!.toString());
    } else {
      const map = output.output.find(
        (item) => item.type === "asset" && item.fileName.endsWith(".map"),
      );
      expect(map?.type === "asset" && map.source).toBe(chunk.map!.toString());
    }
  },
);

it("Unicodeエスケープで綴られたNumberも既存の束縛を考慮する", async () => {
  const source = String.raw`export function run(){return N\u0075mber("0b101");}`;
  const output = await build(source);
  const chunk = output.output[0] as OutputChunk;
  expect(runInNewContext(chunk.code + ";compiled.run()", { Number: aeNumber })).toBe(5);
});

it("Numberの間接参照を診断し、通知設定とローカル束縛を尊重する", async () => {
  const source = `export function run(){var alias=Number; return [alias("2"),new Number(1).valueOf(),Number.call(null,"2"),Number.parseInt("2",10)];}`;
  const warnings: RollupLog[] = [];
  await build(source, false, {}, warnings);
  expect(warnings.filter((warning) => warning.pluginCode === "NUMBER_UNSUPPORTED")).toHaveLength(3);
  expect(warnings[0].loc?.line).toBe(1);
  await expect(build(source, false, {}, [], "error")).rejects.toThrow(/Number/);
  const silent: RollupLog[] = [];
  await build(source, false, {}, silent, "off");
  expect(silent.filter((warning) => warning.pluginCode === "NUMBER_UNSUPPORTED")).toEqual([]);
  const shadowed: RollupLog[] = [];
  await build(`export function f(Number){var alias=Number;return alias(1);}`, false, {}, shadowed);
  expect(shadowed.filter((warning) => warning.pluginCode === "NUMBER_UNSUPPORTED")).toEqual([]);
});

it.each([false, true])(
  "実機と共有する通常・圧縮資料をES3として実行する 圧縮=%s",
  async (compressed) => {
    const bundle = await rollup({
      input: "test/fixtures/number-auto-host-contract.js",
      plugins: [
        ...(compressed ? [terser({ format: { ascii_only: true, ecma: 5 } })] : []),
        extendscriptCompat(),
      ],
      onwarn(warning, defaultHandler) {
        if (warning.pluginCode !== "NUMBER_UNSUPPORTED") defaultHandler(warning);
      },
    });
    try {
      const result = await bundle.generate({
        format: "iife",
        name: "numberAutoProbe",
        footer: "numberAutoProbe.run();",
      });
      const chunk = result.output.find((item) => item.type === "chunk");
      expect(chunk).toBeDefined();
      parse(chunk!.code, { ecmaVersion: 3 });
      const actual = runInNewContext(chunk!.code);
      expect(actual.failures).toEqual([]);
      expect(actual.passed).toBe(actual.total);
    } finally {
      await bundle.close();
    }
  },
);

it("runtime全体の内部Numberを再変換せず、利用側のNumberを補正する", async () => {
  const runtimePath = fileURLToPath(new URL("../runtime/index.js", import.meta.url));
  const sourcePlugin: Plugin = {
    name: "fixture",
    resolveId(id) {
      if (id === "fixture.js") return id;
      if (id === "compat-runtime") return runtimePath;
      return null;
    },
    load(id) {
      if (id === "fixture.js")
        return `import "compat-runtime"; export function run(){return [Number("0b101"),Number.parseInt("a?",16)];}`;
      return null;
    },
  };
  const warnings: RollupLog[] = [];
  const bundle = await rollup({
    input: "fixture.js",
    plugins: [sourcePlugin, extendscriptCompat()],
    onwarn(warning, defaultHandler) {
      warnings.push(warning);
      if (warning.pluginCode !== "NUMBER_UNSUPPORTED") defaultHandler(warning);
    },
  });
  try {
    const result = await bundle.generate({ format: "iife", name: "compiled" });
    const chunk = result.output[0] as OutputChunk;
    expect(Array.from(runInNewContext(chunk.code + ";compiled.run()"))).toEqual([5, 10]);
    expect(warnings.filter((warning) => warning.pluginCode === "NUMBER_UNSUPPORTED")).toEqual([]);
  } finally {
    await bundle.close();
  }
});

it("同じプラグインを重ねてもNumber呼び出しを重複変換しない", async () => {
  const sourcePlugin: Plugin = {
    name: "fixture",
    resolveId: (id) => (id === "fixture.js" ? id : null),
    load: (id) =>
      id === "fixture.js"
        ? `export var count=0; export var result=Number({valueOf:function(){count++;return "0b101";}});`
        : null,
  };
  const bundle = await rollup({
    input: "fixture.js",
    plugins: [sourcePlugin, extendscriptCompat(), extendscriptCompat()],
  });
  try {
    const result = await bundle.generate({ format: "iife", name: "compiled" });
    const chunk = result.output[0] as OutputChunk;
    const actual = runInNewContext(chunk.code + ";compiled", { Number: aeNumber });
    expect(actual.result).toBe(5);
    expect(actual.count).toBe(1);
  } finally {
    await bundle.close();
  }
});
