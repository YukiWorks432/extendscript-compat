import "../../runtime/index.js";
const output: string = "aba".replaceAll("a", "x");
const mapped: string = "aba".replaceAll(/a/g, (match, index) => match + index);
const wellFormed: boolean = output.isWellFormed();
const repaired: string = output.toWellFormed();
void [output, mapped, wellFormed, repaired];
