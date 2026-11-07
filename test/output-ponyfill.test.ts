import { createContext, runInContext } from "node:vm";
import { rollup, type OutputChunk, type OutputOptions, type Plugin } from "rollup";
import terser from "@rollup/plugin-terser";
import { expect, it } from "vitest";
import { extendscriptCompat } from "../src/rollup.js";
import { fileURLToPath } from "node:url";

it.each(["amd", "system"] as const)(
  "未使用の分割%s出力でも依存を除去する",
  async (format) => {
    for (const compressed of [false, true]) {
      const chunks = await build(
        { a: "export var value=42;", b: "export var value=17;" },
        compressed,
        { format, name: undefined, entryFileNames: "[name].js" },
      );
      expect(chunks).toHaveLength(2);
      for (const chunk of chunks) {
        expect(chunk.imports).toEqual([]);
        expect(chunk.code.length).toBeLessThan(1000);
        const exported: Record<string, unknown> = {};
        if (format === "amd") {
          runInContext(
            chunk.code,
            createContext({
              define: (deps: string[], factory: (...args: unknown[]) => void) => {
                expect(Array.from(deps)).toEqual(["exports"]);
                factory(exported);
              },
            }),
          );
        } else {
          runInContext(
            chunk.code,
            createContext({
              System: {
                register: (
                  deps: string[],
                  factory: (publish: (name: string, value: unknown) => unknown) => {
                    execute: () => void;
                  },
                ) => {
                  expect(Array.from(deps)).toEqual([]);
                  factory((name, value) => (exported[name] = value)).execute();
                },
              },
            }),
          );
        }
        expect(exported.value).toBe(chunk.name === "a" ? 42 : 17);
      }
    }
  },
  30000,
);

it.each([false, true])("公開number入口のWindows区切りを正規化する 正斜線=%s", async (forward) => {
  const path = fileURLToPath(new URL("../runtime/number.js", import.meta.url));
  const id = forward ? path.replace(/\\/g, "/") : path;
  const [chunk] = await build(
    {
      entry:
        'import {toNumber} from "extendscript-compat/number";export function run(){return toNumber("0b11");}',
    },
    false,
    {},
    [
      {
        name: "number-path",
        resolveId: (source) => (source === "extendscript-compat/number" ? id : null),
      },
    ],
  );
  const ctx = createContext({});
  runInContext(chunk.code, ctx);
  expect(runInContext("compiled.run()", ctx)).toBe(3);
});
it.each([false, true])("接続名と同名の利用側関数を捕捉しない 圧縮=%s", async (compressed) => {
  const [chunk] = await build(
    {
      entry:
        'function __extendscriptCompatOutputUse__(){}; export function run(x){return Object.keys(x).join(",");}',
    },
    compressed,
  );
  const ctx = createContext({});
  runInContext("delete Object.keys;", ctx);
  runInContext(chunk.code, ctx);
  expect(runInContext("compiled.run({answer:42})", ctx)).toBe("answer");
});
it.each([false, true])(
  "未使用の複数入口に補完本体と読み込みを追加しない 圧縮=%s",
  async (compressed) => {
    const chunks = await build(
      { a: "export var value=42;", b: "export var value=17;" },
      compressed,
      { format: "cjs", entryFileNames: "[name].js", sourcemap: true },
    );
    expect(chunks).toHaveLength(2);
    for (const chunk of chunks) {
      expect(chunk.imports).toEqual([]);
      expect(chunk.code.length).toBeLessThan(250);
    }
  },
);

async function build(
  modules: Record<string, string>,
  compressed = false,
  output: OutputOptions = {},
  extra: Plugin[] = [],
) {
  const bundle = await rollup({
    input: Object.keys(modules).filter((id) => id !== "dependency"),
    external: ["external"],
    plugins: [
      {
        name: "fixture",
        resolveId: (id) => (Object.hasOwn(modules, id) ? id : null),
        load: (id) => modules[id] ?? null,
      },
      ...extra,
      ...(compressed ? [terser({ ie8: true, format: { ascii_only: true } })] : []),
      extendscriptCompat({ runtime: "ponyfill" }),
    ],
  });
  try {
    return (
      await bundle.generate({
        format: "iife",
        name: "compiled",
        generatedCode: { preset: "es5", reservedNamesAsProps: false },
        globals: { external: "external" },
        ...output,
      })
    ).output.filter((item): item is OutputChunk => item.type === "chunk");
  } finally {
    await bundle.close();
  }
}
it.each([false, true])(
  "Rollup生成の名前空間をAPI不足でも初期化する 圧縮=%s",
  async (compressed) => {
    const [chunk] = await build(
      {
        entry:
          'import * as ns from "external";export var namespace=ns;export function run(Function,Object,runtime,__extendscriptOutputRuntime){return [1,2].map(function(v){return v+1;}).join(",")+Number("0b10");}',
      },
      compressed,
    );
    const ctx = createContext({ external: { answer: 42 } });
    runInContext(
      "delete Object.keys;delete Object.freeze;delete Array.prototype.forEach;delete Array.prototype.map;",
      ctx,
    );
    const before = runInContext("Object.getOwnPropertyNames(this).sort().join('|')", ctx);
    runInContext(chunk.code, ctx);
    expect(runInContext("compiled.namespace.answer", ctx)).toBe(42);
    expect(runInContext("compiled.run(1,2,3,4)", ctx)).toBe("2,32");
    expect(
      runInContext(
        "typeof Object.keys+':'+typeof Object.freeze+':'+typeof Array.prototype.map",
        ctx,
      ),
    ).toBe("undefined:undefined:undefined");
    expect(
      runInContext(
        "Object.getOwnPropertyNames(this).filter(function(k){return k!=='compiled';}).sort().join('|')",
        ctx,
      ),
    ).toBe(before);
  },
  30000,
);
it.each([false, true])(
  "CJSの分割出力で補完関数の参照を共有する 圧縮=%s",
  async (compressed) => {
    const chunks = await build(
      { a: "export var ref=Array.prototype.map;", b: "export var ref=Array.prototype.map;" },
      compressed,
      { format: "cjs", entryFileNames: "[name].js" },
    );
    const ctx = createContext({});
    runInContext("delete Array.prototype.map", ctx);
    const cache = new Map<string, Record<string, unknown>>();
    function load(file: string): Record<string, unknown> {
      if (cache.has(file)) return cache.get(file)!;
      const exports = {};
      cache.set(file, exports);
      const chunk = chunks.find((c) => c.fileName === file)!;
      runInContext("(function(exports,require){" + chunk.code + "\n})", ctx)(
        exports,
        (id: string) => load(id.replace(/^\.\//, "")),
      );
      return exports;
    }
    const a = load("a.js"),
      b = load("b.js");
    expect(a.ref).toBe(b.ref);
    expect(typeof a.ref).toBe("function");
    expect((a.ref as Function).call([2, 3], (v: number) => v + 1).join(",")).toBe("3,4");
    expect(runInContext("typeof Array.prototype.map", ctx)).toBe("undefined");
  },
  30000,
);
it("後段で追加した未変換の処理を成功扱いにしない", async () => {
  await expect(
    build({ entry: "export var value=1;" }, false, {}, [
      {
        name: "late-include",
        generateBundle(_options, bundle) {
          for (const item of Object.values(bundle))
            if (item.type === "chunk") item.code += "\ncompiled.value=Object.keys({x:1});";
        },
      },
    ]),
  ).rejects.toThrow("renderChunk後");
});
it("Numberの実装を再変換せず後のグローバル参照変更も観測する", async () => {
  const [chunk] = await build({ entry: "export function run(v){var N=Number;return N(v);}" });
  const ctx = createContext({});
  runInContext(chunk.code, ctx);
  expect(runInContext('compiled.run("0b10")', ctx)).toBe(2);
  runInContext("Number=function(){return 17;};", ctx);
  expect(runInContext('compiled.run("2")', ctx)).toBe(17);
});
