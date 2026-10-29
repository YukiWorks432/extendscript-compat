import "../../runtime/index.js";

const values: number[] = [1, 2];
const readOnly: readonly number[] = values;
const included: boolean = values.includes(2) && readOnly.includes(1);
const padded: string = "x".padStart(2, "0").padEnd(3);
const trimmed: string = " x ".trimStart().trimEnd().trimLeft().trimRight();
void included;
void padded;
void trimmed;
// @ts-expect-error flat is not part of this stage
values.flat();
// @ts-expect-error Promise is not provided by this runtime
Promise.resolve(1);
