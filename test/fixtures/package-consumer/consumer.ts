import { protectCompatibility } from "extendscript-compat";
import { extendscriptCompat } from "extendscript-compat/rollup";
import "extendscript-compat/runtime";
import { toNumber } from "extendscript-compat/number";
import { isNull, subtractUnitValues } from "extendscript-compat/unit-value";
import type { Plugin } from "rollup";

const code: string = protectCompatibility("var result = a || b && c;").code;
const plugin: Plugin = extendscriptCompat();
const ponyfill: Plugin = extendscriptCompat({ runtime: "ponyfill" });
const number: number = toNumber("0b101");
const difference: number = subtractUnitValues(8, 3);
const missing: boolean = isNull(null);
const sorted: number[] = [3, 1, 2].toSorted();
void [code, plugin, ponyfill, number, difference, missing, sorted];
