/**
 * Side-effect-only entry that installs JSON, selected ES5/ES6 and later compatibility methods, and applies four function corrections to the shared ExtendScript engine.
 *
 * ExtendScriptの共有エンジンへJSON・ES5・ES6と後年の一部メソッドの補完、4関数の互換補正を適用する副作用専用の入口。
 */
type ExtendScriptCompatFlatArray<Arr, Depth extends number> = {
  done: Arr;
  recur: Arr extends ReadonlyArray<infer Inner>
    ? ExtendScriptCompatFlatArray<
        Inner,
        [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20][Depth]
      >
    : Arr;
}[Depth extends -1 ? "done" : "recur"];

declare global {
  interface ObjectConstructor {
    hasOwn(o: object, v: PropertyKey): boolean;
    entries<T>(value: { [key: string]: T } | ArrayLike<T>): [string, T][];
    entries(value: {}): [string, any][];
    values<T>(value: { [key: string]: T } | ArrayLike<T>): T[];
    values(value: {}): any[];
  }
  interface Array<T> {
    at(index: number): T | undefined;
    includes(searchElement: T, fromIndex?: number): boolean;
    flat<A, D extends number = 1>(this: A, depth?: D): ExtendScriptCompatFlatArray<A, D>[];
    flatMap<U, This = undefined>(
      callback: (this: This, value: T, index: number, array: T[]) => U | ReadonlyArray<U>,
      thisArg?: This,
    ): U[];
  }
  interface ReadonlyArray<T> {
    at(index: number): T | undefined;
    includes(searchElement: T, fromIndex?: number): boolean;
    flat<A, D extends number = 1>(this: A, depth?: D): ExtendScriptCompatFlatArray<A, D>[];
    flatMap<U, This = undefined>(
      callback: (this: This, value: T, index: number, array: T[]) => U | ReadonlyArray<U>,
      thisArg?: This,
    ): U[];
  }
  interface String {
    replaceAll(searchValue: string | RegExp, replaceValue: string): string;
    replaceAll(
      searchValue: string | RegExp,
      replacer: (substring: string, ...args: any[]) => string,
    ): string;
    isWellFormed(): boolean;
    toWellFormed(): string;
    at(index: number): string | undefined;
    padStart(maxLength: number, fillString?: string): string;
    padEnd(maxLength: number, fillString?: string): string;
    trimStart(): string;
    trimEnd(): string;
    trimLeft(): string;
    trimRight(): string;
  }
}
export {};
