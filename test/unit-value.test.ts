import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { expect, it } from "vitest";
import { isNull, subtractUnitValues } from "extendscript-compat/unit-value";

const source = readFileSync(new URL("../runtime/unit-value.js", import.meta.url), "utf8").replace(
  /export /g,
  "",
);
const fixture = String.raw`
function UnitValue(value,unit){
  this.value=value;this.type=unit;this.baseUnit=null;
}
UnitValue.prototype.valueOf=function(){return this.value;};
`;

it("ホストのないNodeでの明示読込は共有関数を変更せず、通常の数値とnullを扱う", () => {
  const functions = [
    parseInt,
    String.prototype.charAt,
    String.prototype.split,
    String.prototype.replace,
  ];
  expect(subtractUnitValues(10, 2)).toBe(8);
  expect(isNull(null)).toBe(true);
  for (const value of [undefined, 0, false, "", {}, []]) expect(isNull(value)).toBe(false);
  expect([
    parseInt,
    String.prototype.charAt,
    String.prototype.split,
    String.prototype.replace,
  ]).toEqual(functions);
});

it("数値−UnitValueで向き・単位・換算基準を保ち、入力を変更しない", () => {
  const context = createContext({});
  runInContext(fixture + source, context);
  const result = runInContext(
    'var input=new UnitValue(2,"in"); var base={value:1/96,type:"in"}; input.baseUnit=base;' +
      "var result=subtractUnitValues(10,input);" +
      "[result.value,result.type,result.baseUnit===base,result instanceof UnitValue,input.value,input.baseUnit===base]",
    context,
  );
  expect(result).toEqual([8, "in", true, true, 2, true]);
  expect(runInContext('subtractUnitValues(-3,new UnitValue(2,"cm")).value', context)).toBe(-5);
  expect(runInContext('subtractUnitValues(3,new UnitValue(-2,"cm")).value', context)).toBe(5);
});

it("符号付きゼロとNaNを数値演算から引き継ぐ", () => {
  const context = createContext({});
  runInContext(fixture + source, context);
  expect(runInContext('1/subtractUnitValues(-0,new UnitValue(0,"pt")).value', context)).toBe(
    -Infinity,
  );
  expect(runInContext('1/subtractUnitValues(0,new UnitValue(0,"pt")).value', context)).toBe(
    Infinity,
  );
  expect(
    Number.isNaN(runInContext('subtractUnitValues(NaN,new UnitValue(2,"pt")).value', context)),
  ).toBe(true);
});

it("公開契約外の入力を拒否し、測定値に見える普通のオブジェクトを受け入れない", () => {
  const context = createContext({});
  runInContext(fixture + source, context);
  expect(() => runInContext('subtractUnitValues("10",new UnitValue(2,"in"))', context)).toThrow(
    /number or UnitValue/,
  );
  expect(() => runInContext('subtractUnitValues(10,{value:2,type:"in"})', context)).toThrow(
    /number or UnitValue/,
  );
  expect(() => subtractUnitValues("10" as unknown as number, 2)).toThrow(TypeError);
  expect(runInContext('isNull(new UnitValue(0.5,"in"))', context)).toBe(false);
});
