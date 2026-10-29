import "../../runtime/index.js";
const pairs: [string, number][] = Object.entries({ a: 1 });
const flat: number[] = [[1], [2]].flat();
const mapped: number[] = [1, 2].flatMap((value) => [value]);
const character: string | undefined = "text".at(-1);
void [pairs, flat, mapped, character];
