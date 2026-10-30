import "../../runtime/index.js";
const a: readonly (number | string)[] = [1, "a"];
const sorted: (number | string)[] = a.toSorted();
const reversed: (number | string)[] = a.toReversed();
const spliced: (number | string)[] = a.toSpliced(0, 1, 2);
const found: string | undefined = a.findLast((x): x is string => typeof x === "string");
const index: number = a.findLastIndex((x) => typeof x === "number");
void [sorted, reversed, spliced, found, index];
