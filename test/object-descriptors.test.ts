import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { rollup, type Plugin } from "rollup";
import terser from "@rollup/plugin-terser";
import { it, expect } from "vitest";
import { extendscriptCompat } from "../src/rollup.js";
import { minify } from "terser";
import { protectCompatibility } from "../src/index.js";

const contract = readFileSync(
  new URL("./contracts/object-descriptors-contract.js", import.meta.url),
  "utf8",
)
  .trim()
  .replace(/;$/, "");
const runtime = readFileSync(new URL("../runtime/index.js", import.meta.url), "utf8");
const compressedRuntime = protectCompatibility(
  (await minify(runtime, { ie8: true, format: { ascii_only: true } })).code!,
).code;
const missing =
  "delete Object.create;delete Object.defineProperty;delete Object.getOwnPropertyDescriptor;";

it.each([1, 2, 3, 4, 5, 6, 7])(
  "3 APIが部分的に存在する環境でも補完する 欠落=%s",
  async (mask) => {
    const source =
      'function run(){var p={n:3};var o=Object.create(p,{x:{value:7,writable:true,enumerable:true,configurable:true}});Object.defineProperty(o,"y",{value:9,writable:true,enumerable:true,configurable:true});p.n=5;return [o.n,o.x,Object.getOwnPropertyDescriptor(o,"y").value,Object.create===originals[0],Object.defineProperty===originals[1],Object.getOwnPropertyDescriptor===originals[2]];}';
    for (const pure of [false, true]) {
      const ctx = createContext({});
      runInContext(
        "var originals=[Object.create,Object.defineProperty,Object.getOwnPropertyDescriptor];",
        ctx,
      );
      for (const [i, name] of ["create", "defineProperty", "getOwnPropertyDescriptor"].entries())
        if (mask & (1 << i)) runInContext("delete Object." + name, ctx);
      runInContext(pure ? await build("export " + source) : runtime + "\n" + source, ctx);
      const actual = runInContext(pure ? "compiled.run()" : "run()", ctx);
      expect(Array.from(actual)).toEqual([5, 7, 9, !(mask & 1), !(mask & 2), !(mask & 4)]);
    }
  },
  30000,
);

it.each([false, true])(
  "無視された代入と符号付きゼロを成功扱いにしない ponyfill=%s",
  async (pure) => {
    const ctx = createContext({});
    runInContext('var locked={};Object.defineProperty(locked,"zero",{value:0});' + missing, ctx);
    if (pure)
      runInContext(
        await build('export function run(o,v){return Object.defineProperty(o,"zero",{value:v});}'),
        ctx,
      );
    else runInContext(runtime, ctx);
    expect(() =>
      runInContext(
        pure ? "compiled.run(locked,-0)" : 'Object.defineProperty(locked,"zero",{value:-0})',
        ctx,
      ),
    ).toThrow();
    expect(runInContext("1/locked.zero", ctx)).toBe(Infinity);
  },
);
it("限定補完後のReflectは能力を誤認せず、ponyfillもホストを変えない", async () => {
  const ctx = createContext({ limitedObjectDescriptors: true });
  runInContext(missing + "Reflect=undefined;", ctx);
  runInContext(runtime, ctx);
  const refs = runInContext(
    "[Object.create,Object.defineProperty,Object.getOwnPropertyDescriptor]",
    ctx,
  );
  const code = await build(
    "export function run(){return [" +
      contract +
      ",typeof Reflect.defineProperty,typeof Reflect.getOwnPropertyDescriptor,typeof Reflect.get,typeof Reflect.set];}",
  );
  runInContext(code, ctx);
  const results = runInContext("compiled.run()", ctx);
  expect(results[0].failures.length).toBe(0);
  expect(Array.from(results).slice(1)).toEqual([
    "undefined",
    "undefined",
    "undefined",
    "undefined",
  ]);
  const after = runInContext(
    "[Object.create,Object.defineProperty,Object.getOwnPropertyDescriptor]",
    ctx,
  );
  for (let i = 0; i < 3; i++) expect(after[i]).toBe(refs[i]);
});
it("属性APIのない環境で既存のネイティブReflectを壊さない", () => {
  const ctx = createContext({});
  const native = runInContext("Reflect.defineProperty", ctx);
  runInContext(missing, ctx);
  runInContext(runtime, ctx);
  expect(runInContext("Reflect.defineProperty", ctx)).toBe(native);
});
it("旧runtimeを読み込んだ後にも限定Object APIを導入する", () => {
  const ctx = createContext({ limitedObjectDescriptors: true });
  runInContext(missing, ctx);
  runInContext(readFileSync(new URL("./fixtures/runtime-0.2.js", import.meta.url), "utf8"), ctx);
  runInContext(runtime, ctx);
  expect(runInContext(contract, ctx).failures.length).toBe(0);
});
async function build(source: string, compressed = false, output: Record<string, unknown> = {}) {
  const bundle = await rollup({
    input: "entry",
    external: ["external"],
    plugins: [
      {
        name: "fixture",
        resolveId: (id) => (id === "entry" ? id : null),
        load: (id) => (id === "entry" ? source : null),
      } as Plugin,
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
    ).output.find((item) => item.type === "chunk")!.code;
  } finally {
    await bundle.close();
  }
}
for (const pure of [false, true])
  for (const compressed of [false, true])
    for (const limited of [false, true]) {
      it(`Object契約 ponyfill=${pure} 圧縮=${compressed} 限定=${limited}`, async () => {
        const ctx = createContext({ limitedObjectDescriptors: limited });
        if (limited) runInContext(missing, ctx);
        const native = runInContext(
          "[Object.create,Object.defineProperty,Object.getOwnPropertyDescriptor]",
          ctx,
        );
        const code = pure
          ? await build("export function run(){return " + contract + ";}", compressed)
          : compressed
            ? compressedRuntime
            : runtime;
        runInContext(code, ctx);
        const report = runInContext(pure ? "compiled.run()" : contract, ctx);
        expect(Array.from(report.failures)).toEqual([]);
        expect(report.passed).toBe(report.total);
        if (pure || !limited) {
          const after = runInContext(
            "[Object.create,Object.defineProperty,Object.getOwnPropertyDescriptor]",
            ctx,
          );
          for (let i = 0; i < 3; i++) expect(after[i]).toBe(native[i]);
        }
        if (!pure) {
          const refs = runInContext(
            "[Object.create,Object.defineProperty,Object.getOwnPropertyDescriptor]",
            ctx,
          );
          runInContext(runtime, ctx);
          const after = runInContext(
            "[Object.create,Object.defineProperty,Object.getOwnPropertyDescriptor]",
            ctx,
          );
          for (let i = 0; i < 3; i++) expect(after[i]).toBe(refs[i]);
        }
      }, 30000);
    }
it.each([false, true])(
  "Rollup外部名前空間の限定補完 圧縮=%s",
  async (compressed) => {
    const source = 'import * as ns from "external";export var namespace=ns;';
    const code = await build(source, compressed, { externalLiveBindings: false });
    const ctx = createContext({ external: { answer: 42 } });
    runInContext(missing, ctx);
    runInContext(code, ctx);
    expect(runInContext("compiled.namespace.answer", ctx)).toBe(42);
    runInContext("external.answer=43;", ctx);
    expect(runInContext("compiled.namespace.answer", ctx)).toBe(42);
    const live = await build(source, compressed);
    const liveCtx = createContext({ external: { answer: 42 } });
    runInContext(missing, liveCtx);
    expect(() => runInContext(live, liveCtx)).toThrow(/Accessor/);
    const nativeCtx = createContext({ external: { answer: 42 } });
    runInContext(live, nativeCtx);
    runInContext("external.answer=43;", nativeCtx);
    expect(runInContext("compiled.namespace.answer", nativeCtx)).toBe(43);
  },
  30000,
);
it("検出可能なアクセサーを実行せずに拒否し、値を一度だけ取得する", async () => {
  const code = await build(
    "export function define(o,k,d){return Object.defineProperty(o,k,d);}export function descriptor(o,k){return Object.getOwnPropertyDescriptor(o,k);}",
  );
  const ctx = createContext({});
  runInContext(
    'var nativeDefine=Object.defineProperty;var calls=0;var accessor={};nativeDefine(accessor,"x",{get:function(){calls++;return 7;}});var attrs={};nativeDefine(attrs,"value",{get:function(){calls++;return 9;}});' +
      missing,
    ctx,
  );
  runInContext(code, ctx);
  expect(() => runInContext('compiled.descriptor(accessor,"x")', ctx)).toThrow(/Accessor/);
  expect(runInContext("calls", ctx)).toBe(0);
  expect(runInContext('compiled.define({},"x",attrs).x', ctx)).toBe(9);
  expect(runInContext("calls", ctx)).toBe(1);
});
it("nullプロトタイプを作れない環境で通常オブジェクトへ代用しない", async () => {
  const code = await build("export function run(){return Object.create(null);}");
  const ctx = createContext({});
  runInContext(missing + "delete Object.prototype.__proto__;", ctx);
  runInContext(code, ctx);
  expect(() => runInContext("compiled.run()", ctx)).toThrow(/Null prototypes/);
});
