import "../../runtime/index.js";

const values: number[] = [1, 2];
const readOnly: readonly number[] = values;
const included: boolean = values.includes(2) && readOnly.includes(1);
const padded: string = "x".padStart(2, "0").padEnd(3);
const trimmed: string = " x ".trimStart().trimEnd().trimLeft().trimRight();
void included;
void padded;
void trimmed;
const flattened: number[] = [[1], [2]].flat();
const mapped: number[] = values.flatMap((value) => [value, value]);
const readonlyFlattened: number[] = ([[1], [2]] as readonly number[][]).flat();
const pairs: [string, number][] = Object.entries({ a: 1 });
const objectValues: number[] = Object.values({ a: 1 });
const character: string | undefined = "abc".at(-1);
void [flattened, mapped, readonlyFlattened, pairs, objectValues, character];
// @ts-expect-error Promise is not provided by this runtime
Promise.resolve(1);
