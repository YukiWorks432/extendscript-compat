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
  const result =
    value === "0b101" || value === "0o10" ? NaN : arguments.length === 0 ? 0 : Number(value);
  if (new.target) return new Number(result);
  return result;
}
aeNumber.prototype = Number.prototype;
Object.setPrototypeOf(aeNumber, Number);

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

it("Numberの静的メソッドと構築したオブジェクトを保つ", async () => {
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
  expect(warnings.filter((warning) => warning.pluginCode === "NUMBER_UNSUPPORTED")).toHaveLength(1);
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

it.each([false, true])(
  "Numberコンストラクタの値とオブジェクトの性質を保つ 圧縮=%s",
  async (compressed) => {
    const source = `export function run(){
    var order=[];
    var value={valueOf:function(){order.push("coerce");return "0b101";}};
    var a=new Number((order.push("first"),value),(order.push("second"),123));
    var b=new Number(); var c=new Number(undefined); var d=new Number;
    var e=new (Number); var f=new (Number)(); var g=new Number(/*comment*/);
    var nested=new Number(Number("0b101"));
    return [a.valueOf(),a instanceof Number,typeof a,order.join(","),b.valueOf(),isNaN(c.valueOf()),d.valueOf(),e.valueOf(),f.valueOf(),g.valueOf(),nested.valueOf()];
  }`;
    const output = await build(source, compressed);
    const chunk = output.output[0] as OutputChunk;
    const actual = runInNewContext(chunk.code + ";compiled.run()", { Number: aeNumber });
    expect(Array.from(actual)).toEqual([
      5,
      true,
      "object",
      "first,second,coerce",
      0,
      true,
      0,
      0,
      0,
      0,
      5,
    ]);
  },
);

it.each([false, true])(
  "参照先が変わらず初期化済みの別名だけを変換する 圧縮=%s",
  async (compressed) => {
    const source = `export function run(){
    var convert=Number;
    var before=convert===Number;
    var value=convert("0b101");
    var after=convert===Number;
    return [value,before,after];
  }`;
    const warnings: RollupLog[] = [];
    const output = await build(source, compressed, {}, warnings);
    const chunk = output.output[0] as OutputChunk;
    expect(
      Array.from(runInNewContext(chunk.code + ";compiled.run()", { Number: aeNumber })),
    ).toEqual([5, true, true]);
    expect(warnings.filter((x) => x.pluginCode === "NUMBER_UNSUPPORTED")).toEqual([]);
  },
);

it("再代入・外部流出・条件付き初期化・初期化前呼び出し・別関数の別名は変更せず診断する", async () => {
  const source = `export function run(){
    var before; try{before=early("0b101");}catch(e){before="error";} var early=Number;
    var changed=Number; changed=function(){return "changed";};
    var escaped=Number; var box={value:escaped};
    if(false){var conditional=Number;}
    var closure=Number; function nested(){return closure("0b101");}
    return [before,changed("0b101"),box.value("0b101"),typeof conditional,nested()];
  }`;
  const warnings: RollupLog[] = [];
  const output = await build(source, false, {}, warnings);
  const chunk = output.output[0] as OutputChunk;
  expect(Array.from(runInNewContext(chunk.code + ";compiled.run()", { Number: aeNumber }))).toEqual(
    ["error", "changed", NaN, "undefined", NaN],
  );
  expect(warnings.filter((x) => x.pluginCode === "NUMBER_UNSUPPORTED")).toHaveLength(5);
});

it("独自のNumberコンストラクタや別名のコンストラクタを保持する", async () => {
  const source = `export function run(){function local(Number){return new Number("0b101").valueOf();}var alias=Number;return [local(function(x){this.valueOf=function(){return "custom:"+x;};}),new alias("0b101").valueOf()];}`;
  const warnings: RollupLog[] = [];
  const output = await build(source, false, {}, warnings);
  const chunk = output.output[0] as OutputChunk;
  expect(Array.from(runInNewContext(chunk.code + ";compiled.run()", { Number: aeNumber }))).toEqual(
    ["custom:0b101", NaN],
  );
  expect(warnings.filter((x) => x.pluginCode === "NUMBER_UNSUPPORTED")).toHaveLength(1);
});

it("直接evalが別名を変更できる場合は自動変換しない", async () => {
  const source = `export function run(){var alias=Number; eval('alias = function(){ return "changed"; }'); return alias("0b101");}`;
  const warnings: RollupLog[] = [];
  const output = await build(source, false, {}, warnings);
  const chunk = output.output[0] as OutputChunk;
  expect(runInNewContext(chunk.code + ";compiled.run()", { Number: aeNumber })).toBe("changed");
  expect(warnings.filter((x) => x.pluginCode === "NUMBER_UNSUPPORTED")).toHaveLength(1);
});

it("Numberコンストラクタにプラグインを重ねても追加の数値変換を行わない", async () => {
  const sourcePlugin: Plugin = {
    name: "fixture",
    resolveId: (id) => (id === "fixture.js" ? id : null),
    load: (id) =>
      id === "fixture.js" ? `export function run(){return new Number("0b101").valueOf();}` : null,
  };
  const bundle = await rollup({
    input: "fixture.js",
    plugins: [sourcePlugin, extendscriptCompat(), extendscriptCompat()],
  });
  const calls: unknown[] = [];
  function countedNumber(value?: unknown) {
    calls.push(value);
    const result = value === "0b101" ? NaN : Number(value);
    return new.target ? new Number(result) : result;
  }
  countedNumber.prototype = Number.prototype;
  try {
    const result = await bundle.generate({ format: "iife", name: "compiled" });
    const chunk = result.output[0] as OutputChunk;
    expect(runInNewContext(chunk.code + ";compiled.run()", { Number: countedNumber })).toBe(5);
    expect(calls).toEqual([5]);
  } finally {
    await bundle.close();
  }
});

it.each([true, "inline", "hidden"] as const)(
  "コンストラクタと別名を変換してもソースマップ %s が元位置を保つ",
  async (sourcemap) => {
    const source = `export function run(input){var convert=Number;var box=new Number(input);return flag || convert(box) && marker;}`;
    const output = await build(source, false, { sourcemap });
    const chunk = output.output[0] as OutputChunk;
    for (const token of ["flag", "marker"]) {
      const offset = chunk.code.lastIndexOf(token);
      const prefix = chunk.code.slice(0, offset).split("\n");
      const mapped = originalPositionFor(new TraceMap(chunk.map!.toString()), {
        line: prefix.length,
        column: prefix.at(-1)!.length,
      });
      expect(mapped.source).toMatch(/fixture\.js$/);
      expect(mapped.line).toBe(1);
      expect(mapped.column).toBe(source.indexOf(token));
    }
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

it.each([false, true])(
  "拡張した実機資料の通常版・圧縮版がES3で変換契約を満たす 圧縮=%s",
  async (compressed) => {
    const bundle = await rollup({
      input: "test/fixtures/number-constructor-alias-host-contract.js",
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
      const actual = runInNewContext(chunk!.code, { Number: aeNumber });
      expect(actual.failures).toEqual([]);
      expect(actual.passed).toBe(actual.total);
    } finally {
      await bundle.close();
    }
  },
);

it.each([false, true])(
  "括弧を省略した入れ子のNumberコンストラクタを正しく変換する 圧縮=%s",
  async (compressed) => {
    const source = `export function run(){return [new Number(new Number),new Number(new Number(new Number)),new Number(/*comment*/new Number)];}`;
    const output = await build(source, compressed);
    const chunk = output.output[0] as OutputChunk;
    const actual = runInNewContext(chunk.code + ";compiled.run()", { Number: aeNumber });
    expect(Array.from(actual, (value) => Number(value))).toEqual([0, 0, 0]);
    expect(actual.every((value: unknown) => value instanceof Number)).toBe(true);
  },
);

it("変換後のNumberオブジェクトのinstanceof判定には不要な警告を出さない", async () => {
  const warnings: RollupLog[] = [];
  const output = await build(
    `export function run(){var box=new Number("0b101");return [box.valueOf(),box instanceof Number];}`,
    false,
    {},
    warnings,
  );
  const chunk = output.output[0] as OutputChunk;
  expect(Array.from(runInNewContext(chunk.code + ";compiled.run()", { Number: aeNumber }))).toEqual(
    [5, true],
  );
  expect(warnings.filter((x) => x.pluginCode === "NUMBER_UNSUPPORTED")).toEqual([]);
});
