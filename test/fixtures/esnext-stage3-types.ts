import "../../runtime/index.js";
const values: number[] = [1, 2];
const readonlyValues: readonly number[] = values;
const x: number | undefined = values.at(-1);
const y: number | undefined = readonlyValues.at(0);
const has: boolean = Object.hasOwn(values, "length");
void [x, y, has];
