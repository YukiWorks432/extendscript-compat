import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { rollup, type OutputChunk, type Plugin } from "rollup";
import terser from "@rollup/plugin-terser";
import { expect, it } from "vitest";
import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import { fileURLToPath } from "node:url";
import { extendscriptCompat } from "../src/rollup.js";

async function build(source: string, compressed = false, pure = true) {
  const fixture: Plugin = {
    name: "fixture",
    resolveId: (id) =>
      id === "fixture.js"
        ? id
        : id === "extendscript-compat/runtime"
          ? fileURLToPath(new URL("../runtime/index.js", import.meta.url))
          : null,
    load: (id) => (id === "fixture.js" ? source : null),
  };
  const bundle = await rollup({
    input: "fixture.js",
    plugins: [
      fixture,
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

const missing = `
JSON = undefined;
delete Array.isArray; delete Object.keys; delete Function.prototype.bind;
delete Date.now; delete Date.prototype.toISOString; delete Date.prototype.toJSON;
delete Array.from; delete Array.of; delete Object.assign;
delete Number.isFinite; delete Number.isNaN; delete Number.isInteger; delete Number.isSafeInteger;
delete String.fromCodePoint; delete String.raw;
var arrayNames = "forEach map filter every some reduce reduceRight indexOf lastIndexOf find findIndex copyWithin fill keys values entries includes at flat flatMap toSorted toReversed toSpliced findLast findLastIndex".split(" ");
var stringNames = "trim repeat startsWith endsWith includes codePointAt at padStart padEnd trimStart trimEnd trimLeft trimRight replaceAll isWellFormed toWellFormed".split(" ");
for (var i = 0; i < arrayNames.length; i++) delete Array.prototype[arrayNames[i]];
for (i = 0; i < stringNames.length; i++) delete String.prototype[stringNames[i]];
delete Math.trunc;
`;
const contracts = [
  "freeze",
  "polyfill",
  "runtime",
  "includes-padding-trimming",
  "entries-flattening-string-at",
  "array-at-has-own",
  "array-copy-search",
  "string-modern",
  "json-parse",
  "json-stringify",
  "ponyfill-boundaries",
].map((name) =>
  readFileSync(new URL(`./contracts/${name}-contract.js`, import.meta.url), "utf8")
    .trim()
    .replace(/;$/, ""),
);

function snapshot(context: ReturnType<typeof createContext>) {
  const targets = runInContext(
    "[globalThis, Object, Object.prototype, Array, Array.prototype, String, String.prototype, Function, Function.prototype, Number, Number.prototype, Date, Date.prototype, Math, RegExp, RegExp.prototype, typeof JSON === 'undefined' ? {} : JSON, typeof Reflect === 'undefined' ? {} : Reflect]",
    context,
  ) as object[];
  return Array.from(targets, (target) => {
    const descriptors = Object.getOwnPropertyDescriptors(target);
    delete descriptors.compiled;
    return descriptors;
  });
}

function expectUnchanged(before: ReturnType<typeof snapshot>, after: ReturnType<typeof snapshot>) {
  for (let i = 0; i < before.length; i++) {
    expect(Reflect.ownKeys(after[i]), `target ${i} keys`).toEqual(Reflect.ownKeys(before[i]));
    for (const key of Reflect.ownKeys(before[i])) {
      const expected = Reflect.get(before[i], key);
      const actual = Reflect.get(after[i], key);
      for (const field of ["value", "get", "set", "writable", "enumerable", "configurable"]) {
        expect(Reflect.get(actual, field), `target ${i}.${String(key)}.${field}`).toBe(
          Reflect.get(expected, field),
        );
      }
    }
  }
}

it.each([false, true])(
  "ES5以降の契約を補完し、ホストを変更しない 圧縮=%s",
  async (compressed) => {
    // コピー操作の既存契約はArray.prototype[0]を一時定義するため、配列長も復元する。
    const checks = contracts.map(
      (contract) =>
        `(function(){var length=Array.prototype.length;try{return (\n${contract}\n);}finally{Array.prototype.length=length;}})()`,
    );
    const chunk = await build(
      `import "extendscript-compat/runtime"; export function run() { return [${checks.join(",\n")}]; }`,
      compressed,
    );
    const context = createContext({});
    runInContext(missing, context);
    const before = snapshot(context);
    runInContext(chunk.code, context);
    const reports = runInContext("compiled.run()", context);
    for (const report of reports) expect(report.failures).toEqual([]);
    expectUnchanged(before, snapshot(context));
    runInContext("compiled.run()", context);
    expectUnchanged(before, snapshot(context));
    // Windows CIでは全契約のバンドル生成・圧縮も含めると既定の5秒を超える。
  },
  30000,
);

it("メソッド取得・引数の順序とthisを保ち、独自メソッドとローカルの組み込み名を保持する", async () => {
  const chunk = await build(`export function run() {
    var seen=[], original;
    var object={};
    Object.defineProperty(object, "map", {get:function(){seen.push("get"); object=null; return function(fn){seen.push(this===original ? "this" : "wrong");return fn(4);};}});
    original=object;
    function argument(){seen.push("arg");return function(x){return x*3;};}
    var value=object.map(argument());
    function local(Object){return Object.keys(7);}
    var custom={keys:function(x){return x+1;}};
    var array=[1]; array.map=undefined;
    return [value,seen.join(","),local(custom),array.map,({map:function(){return 9;}}).map()];
  }`);
  const context = createContext({});
  runInContext(chunk.code, context);
  expect(Array.from(runInContext("compiled.run()", context))).toEqual([
    12,
    "get,arg,this",
    8,
    undefined,
    9,
  ]);
});

it("メソッド参照、借用、静的な角括弧と別名を補完する", async () => {
  const chunk = await build(
    `export function run(){var map=Array.prototype.map; var keys=Object.keys; var f=[1,2]["map"];return [map.call({0:3,length:1},function(x){return x+1;})[0],f.apply([2], [function(x){return x*2;}])[0],keys({x:1})[0]];}`,
  );
  const context = createContext({});
  runInContext(missing, context);
  runInContext(chunk.code, context);
  expect(Array.from(runInContext("compiled.run()", context))).toEqual([4, 4, "x"]);
});

it("組み込みを凍結した環境でも動き、JSONの日付とラッパーを内部で出力する", async () => {
  const chunk = await build(
    `export function run(){return [[1,2].map(function(x){return x*2;}).join(","),JSON.stringify([new Date(0),new Number(2),new String("x"),new Boolean(false)])];}`,
  );
  const context = createContext({});
  runInContext(missing, context);
  runInContext(
    "Object.freeze(Array.prototype); Object.freeze(String.prototype); Object.freeze(Function.prototype); Object.freeze(Number.prototype); Object.freeze(Date.prototype); Object.freeze(Object.prototype); Object.freeze(Array); Object.freeze(Object); Object.freeze(Number); Object.freeze(Date); Object.freeze(Math);",
    context,
  );
  runInContext(chunk.code, context);
  expect(Array.from(runInContext("compiled.run()", context))).toEqual([
    "2,4",
    '["1970-01-01T00:00:00.000Z",2,"x",false]',
  ]);
});

it("設定を外すと従来の/runtimeがホストへ補完する", async () => {
  const chunk = await build(
    'import "extendscript-compat/runtime"; export function run(){return [1].map(function(x){return x+1;})[0];}',
    false,
    false,
  );
  const context = createContext({});
  runInContext(missing, context);
  runInContext(chunk.code, context);
  expect(runInContext("compiled.run()", context)).toBe(2);
  expect(runInContext("typeof Array.prototype.map", context)).toBe("function");
});

it("Numberとponyfillを同時に変換しても元の位置を追跡できる", async () => {
  const chunk = await build(
    'export function run(){\n  return [Number("0b10")].map(function(value){ return value; });\n}',
  );
  const line = chunk.code.split("\n").findIndex((text) => text.includes('"0b10"'));
  const column = chunk.code.split("\n")[line].indexOf('"0b10"');
  const position = originalPositionFor(new TraceMap(chunk.map!.toString()), {
    line: line + 1,
    column,
  });
  expect(position.line).toBe(2);
  const context = createContext({});
  runInContext(chunk.code, context);
  expect(Array.from(runInContext("compiled.run()", context))).toEqual([2]);
});

it("ES5の走査、検索、右からの集約とbindのコンストラクターを補完する", async () => {
  const chunk = await build(`export function run(){
    var seen=[],a=[1,2,3];delete a[1];a.forEach(function(x,i){seen.push(x+i);});
    function C(a,b){this.total=a+b;} C.prototype.label="bound";
    var Bound=C.bind({ignored:true},2),instance=new Bound(5);
    return [seen.join(","),a.every(function(x){return x>0;}),a.some(function(x){return x===3;}),a.indexOf(3),a.lastIndexOf(1),a.reduceRight(function(a,b){return a-b;}),instance.total,instance.label,instance instanceof C];
  }`);
  const context = createContext({});
  runInContext(missing, context);
  runInContext(chunk.code, context);
  expect(Array.from(runInContext("compiled.run()", context))).toEqual([
    "1,5",
    true,
    true,
    2,
    0,
    2,
    7,
    "bound",
    true,
  ]);
});

it("日付と数値のES5補正、文字列と反復子とMathのES6補完を利用できる", async () => {
  const chunk = await build(`export function run(){
    var iterator=[4,5].entries();
    return [Date.parse("2000-01-01T00:00:00.000Z"),new Date(-1).toISOString(),new Date(NaN).toJSON(),(1.255).toFixed(2),
      String.fromCodePoint(0x1f600).codePointAt(0),"ab".repeat(2),String.raw({raw:["a","b"]},7),
      iterator.next().value.join(","),iterator.next().value.join(","),iterator.next().done,
      Array.from("😀").length,Math.trunc(-1.9),Math.imul(0xffffffff,5),Math.hypot(3,4),Number.isSafeInteger(9007199254740991)];
  }`);
  const context = createContext({});
  runInContext(missing + "delete Math.imul;delete Math.hypot;", context);
  runInContext(chunk.code, context);
  expect(Array.from(runInContext("compiled.run()", context))).toEqual([
    946684800000,
    "1969-12-31T23:59:59.999Z",
    null,
    "1.25",
    0x1f600,
    "abab",
    "a7b",
    "0,4",
    "1,5",
    true,
    1,
    -1,
    -5,
    5,
    true,
  ]);
});

it("初期化と例外処理の途中でも組み込みへの書き込みを行わない", async () => {
  const chunk = await build(
    `export function run(){var calls=0;try{null.map(calls++);}catch(e){} try{[1].map(function(){throw new Error("callback");});}catch(e){} return [calls,[1].map(function(x){return x+1;})[0]];}`,
  );
  const context = createContext({});
  runInContext(missing, context);
  runInContext(
    `var nativeDefine=Object.defineProperty,hostTargets=[Array,Array.prototype,String,String.prototype,Date,Date.prototype,Number,Number.prototype,Function,Function.prototype,Object,Object.prototype,Math];
    Object.defineProperty=function(target,key,descriptor){for(var i=0;i<hostTargets.length;i++)if(target===hostTargets[i])throw new Error("Host write: "+key);return nativeDefine(target,key,descriptor);};`,
    context,
  );
  const before = snapshot(context);
  runInContext(chunk.code, context);
  expect(Array.from(runInContext("compiled.run()", context))).toEqual([0, 2]);
  expectUnchanged(before, snapshot(context));
});

it("呼び出せないメソッドでも引数を評価し、独自のcallプロパティに依存しない", async () => {
  const chunk = await build(
    `export function run(){var calls=0;for(var i=0;i<2;i++){var o={map:i?undefined:null};try{o.map(calls++);}catch(e){}}var custom=function(x){return this.base+x;};custom.call=null;return [calls,({base:3,map:custom}).map(4),Array["prototype"]["map"].call([2],function(x){return x+1;})[0]];}`,
  );
  const context = createContext({});
  runInContext(missing, context);
  runInContext(chunk.code, context);
  expect(Array.from(runInContext("compiled.run()", context))).toEqual([2, 7, 3]);
});

it("継承された独自メソッドを保ち、無関係なgetterを呼ばない", async () => {
  const chunk = await build(`export function run(){
    var parent={map:function(){return 9;}},o=Object.create(parent);
    Object.defineProperty(o,Symbol.toStringTag,{get:function(){throw new Error("tag");}});
    return [o.map(),[].map.call({0:3,length:1},function(x){return x+1;})[0]];
  }`);
  const context = createContext({});
  runInContext(missing, context);
  runInContext(chunk.code, context);
  expect(Array.from(runInContext("compiled.run()", context))).toEqual([9, 4]);
});

it("Reflectがない環境でも、ホストの属性操作が支える範囲を補完する", async () => {
  const chunk = await build(
    `export function run(){var o={a:1};Reflect.defineProperty(o,"b",{value:2,enumerable:true});return [Reflect.apply(function(x){return this.n+x;},{n:3},[4]),Reflect.has(o,"a"),Reflect.get(o,"b"),Reflect.set(o,"a",5),Reflect.ownKeys(o).join(","),o.a,Reflect.construct(function C(x){this.x=x;},[7]).x];}`,
  );
  const context = createContext({});
  runInContext(missing + "Reflect=undefined;", context);
  const before = snapshot(context);
  runInContext(chunk.code, context);
  expect(Array.from(runInContext("compiled.run()", context))).toEqual([
    7,
    true,
    2,
    true,
    "a,b",
    5,
    7,
  ]);
  expectUnchanged(before, snapshot(context));
});

it("属性情報やSymbolがないES3相当の環境でもES5補完を利用できる", async () => {
  const chunk = await build(
    `export function run(){return [${contracts[0]},[4].values().next().value,JSON.stringify({a:new Date(0)}),Array.from("😀").length];}`,
  );
  const context = createContext({});
  runInContext(
    missing +
      "Object.defineProperty=undefined;Object.getOwnPropertyDescriptor=undefined;Object.getOwnPropertyNames=undefined;Object.getPrototypeOf=undefined;Object.setPrototypeOf=undefined;Symbol=undefined;Reflect=undefined;",
    context,
  );
  const before = snapshot(context);
  runInContext(chunk.code, context);
  const report = runInContext("compiled.run()", context);
  expect(report[0].failures).toEqual([]);
  expect(Array.from(report).slice(1)).toEqual([4, '{"a":"1970-01-01T00:00:00.000Z"}', 1]);
  expectUnchanged(before, snapshot(context));
});

it("取り込んだ依存モジュールも自動変換する", async () => {
  const sources: Record<string, string> = {
    "entry.js": 'import {read} from "dependency.js";export function run(){return read([1,2]);}',
    "dependency.js":
      'import "extendscript-compat/runtime";export function read(values){return JSON.stringify(values.map(function(x){return x+1;}));}',
  };
  const bundle = await rollup({
    input: "entry.js",
    plugins: [
      {
        name: "dependencies",
        resolveId: (id) => (Object.hasOwn(sources, id) ? id : null),
        load: (id) => sources[id],
      },
      extendscriptCompat({ runtime: "ponyfill" }),
    ],
  });
  try {
    const chunk = (await bundle.generate({ format: "iife", name: "compiled" }))
      .output[0] as OutputChunk;
    const context = createContext({});
    runInContext(missing, context);
    const before = snapshot(context);
    runInContext(chunk.code, context);
    expect(runInContext("compiled.run()", context)).toBe("[2,3]");
    expectUnchanged(before, snapshot(context));
  } finally {
    await bundle.close();
  }
});

it("既存の不具合を持つ組み込みも置き換えず、変換した呼び出しだけ補正する", async () => {
  const source =
    'export function run(){return [parseInt("a?",16),"x\\0y".charAt(1).length,"ab".split(/b/).length,"b".replace(/(a)|(b)/,"$1$2")];}';
  const chunk = await build(source);
  const context = createContext({});
  runInContext(
    `var nativeParseInt=parseInt,nativeCharAt=String.prototype.charAt,nativeSplit=String.prototype.split,nativeReplace=String.prototype.replace;
parseInt=function(text,radix){return text==="a?"&&radix===16?175:nativeParseInt(text,radix);};
String.prototype.charAt=function(i){var c=nativeCharAt.call(this,i);return c===String.fromCharCode(0)?"":c;};
String.prototype.split=function(sep,limit){var parts=nativeSplit.call(this,sep,limit);if(sep instanceof RegExp&&parts[parts.length-1]==="")parts.pop();return parts;};
String.prototype.replace=function(search,replacement){return String(this)==="b"&&replacement==="$1$2"?"undefinedb":nativeReplace.call(this,search,replacement);};`,
    context,
  );
  expect(Array.from(runInContext(source.replace("export ", "") + ";run()", context))).toEqual([
    175,
    0,
    1,
    "undefinedb",
  ]);
  const before = snapshot(context);
  runInContext(chunk.code, context);
  expect(Array.from(runInContext("compiled.run()", context))).toEqual([10, 1, 2, "b"]);
  expectUnchanged(before, snapshot(context));
});
