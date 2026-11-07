import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { rollup, type OutputChunk } from "rollup";
import terser from "@rollup/plugin-terser";
import { expect, it } from "vitest";
import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import { extendscriptCompat } from "../src/rollup.js";

async function build(
  pure: boolean,
  compressed: boolean,
  source = `
import * as library from "library";
export function namespace(){return library;}
export function run(key){var object={a:1};return [library[key],Object.freeze(object)===object];}
`,
) {
  const bundle = await rollup({
    input: "entry",
    plugins: [
      {
        name: "fixture",
        resolveId: (id) => (id === "entry" || id === "library" ? id : null),
        load: (id) => (id === "entry" ? source : id === "library" ? "export var value=42;" : null),
      },
      ...(compressed ? [terser({ ie8: true, format: { ascii_only: true } })] : []),
      extendscriptCompat(pure ? { runtime: "ponyfill" } : {}),
    ],
  });
  try {
    return (await bundle.generate({ format: "iife", name: "compiled", sourcemap: true }))
      .output[0] as OutputChunk;
  } finally {
    await bundle.close();
  }
}

it.each([
  [false, false],
  [false, true],
  [true, false],
  [true, true],
])(
  "Rollupの名前空間をfreezeなしで初期化し、既存freezeも保持する ponyfill=%s 圧縮=%s",
  async (pure, compressed) => {
    const chunk = await build(pure, compressed);
    const missing = createContext({});
    runInContext(
      "delete Object.freeze;var before=Object.getOwnPropertyNames(Object).join('|');",
      missing,
    );
    runInContext(chunk.code, missing);
    expect(Array.from(runInContext("compiled.run('value')", missing))).toEqual([42, true]);
    expect(runInContext("typeof Object.freeze", missing)).toBe("undefined");
    expect(runInContext("Object.getOwnPropertyNames(Object).join('|')===before", missing)).toBe(
      true,
    );
    const native = createContext({});
    runInContext("var original=Object.freeze;", native);
    runInContext(chunk.code, native);
    expect(runInContext("Object.isFrozen(compiled.namespace())", native)).toBe(true);
    expect(runInContext("Object.freeze===original", native)).toBe(true);
    expect(Array.from(runInContext("compiled.run('value')", native))).toEqual([42, true]);
  },
  30000,
);

it("直接呼び出しのgetter・引数・this・追加引数を保ち、単なる参照とローカルObjectを保持する", async () => {
  const chunk = await build(
    false,
    false,
    `export function run(){var object={};function local(Object){return Object.freeze(3);}return [Object.freeze((seen.push("arg"),object),7)===object,local({freeze:function(v){return v+1;}})];}`,
  );
  const context = createContext({});
  runInContext(
    `var seen=[];Object.defineProperty(Object,"freeze",{configurable:true,get:function(){seen.push("get");var method=function(v,extra){seen.push(this===Object?"this":"wrong");seen.push(extra);return v;};method.call=null;return method;}});`,
    context,
  );
  runInContext(chunk.code, context);
  expect(Array.from(runInContext("compiled.run()", context))).toEqual([true, 4]);
  expect(Array.from(runInContext("seen", context))).toEqual(["get", "arg", "this", 7]);
  const references = await build(
    false,
    false,
    `export function run(){return Object.freeze||fallback;}`,
  );
  const absent = createContext({ fallback: 123 });
  runInContext("delete Object.freeze", absent);
  runInContext(references.code, absent);
  expect(runInContext("compiled.run()", absent)).toBe(123);
});

it("ponyfillの関数参照とpolyfillは同じ値を返す代替処理を提供する", async () => {
  const chunk = await build(
    true,
    false,
    `export function run(){var freeze=Object.freeze;var value={a:1};return [freeze(value)===value,freeze(3),freeze(null),freeze()];}`,
  );
  const context = createContext({});
  runInContext("delete Object.freeze", context);
  runInContext(chunk.code, context);
  expect(Array.from(runInContext("compiled.run()", context))).toEqual([true, 3, null, undefined]);
  expect(runInContext("typeof Object.freeze", context)).toBe("undefined");
  const runtime = readFileSync(new URL("../runtime/index.js", import.meta.url), "utf8");
  const polyfill = createContext({});
  runInContext("delete Object.freeze", polyfill);
  runInContext(runtime, polyfill);
  expect(runInContext("var object={a:1}; Object.freeze(object)===object", polyfill)).toBe(true);
  expect(runInContext("Object.freeze(3)", polyfill)).toBe(3);
  expect(runInContext("object.a=2;object.a", polyfill)).toBe(2);
  runInContext("var installed=Object.freeze", polyfill);
  runInContext(runtime, polyfill);
  expect(runInContext("Object.freeze===installed", polyfill)).toBe(true);
  const native = createContext({});
  runInContext("var original=Object.freeze", native);
  runInContext(runtime, native);
  expect(runInContext("Object.freeze===original", native)).toBe(true);
});

it("freeze補正の前後でも利用側のソース位置を追跡できる", async () => {
  const chunk = await build(
    false,
    false,
    "export function run(){\nreturn Object.freeze({value:42});\n}",
  );
  const offset = chunk.code.lastIndexOf("value:");
  const prefix = chunk.code.slice(0, offset).split("\n");
  const position = originalPositionFor(new TraceMap(chunk.map!.toString()), {
    line: prefix.length,
    column: prefix.at(-1)!.length,
  });
  expect(position.source).toBe("entry");
  expect(position.line).toBe(2);
  expect(position.column).toBe(22);
});

it.each([false, true])("利用側のFunctionという引数を捕捉しない ponyfill=%s", async (pure) => {
  const chunk = await build(
    pure,
    false,
    "export function run(Function){return Object.freeze({value:42}).value;}",
  );
  const context = createContext({});
  runInContext(chunk.code, context);
  expect(runInContext("compiled.run({})", context)).toBe(42);
  const missing = createContext({});
  runInContext("delete Object.freeze", missing);
  runInContext(chunk.code, missing);
  expect(runInContext("compiled.run({})", missing)).toBe(42);
});
