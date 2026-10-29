/**
 * Side-effect-only entry that installs JSON, selected ES5/ES6 and later compatibility methods, and applies four function corrections to the shared ExtendScript engine.
 *
 * ExtendScriptの共有エンジンへJSON・ES5・ES6と後年の一部メソッドの補完、4関数の互換補正を適用する副作用専用の入口。
 */
declare global {
  interface Array<T> {
    includes(searchElement: T, fromIndex?: number): boolean;
  }
  interface ReadonlyArray<T> {
    includes(searchElement: T, fromIndex?: number): boolean;
  }
  interface String {
    padStart(maxLength: number, fillString?: string): string;
    padEnd(maxLength: number, fillString?: string): string;
    trimStart(): string;
    trimEnd(): string;
    trimLeft(): string;
    trimRight(): string;
  }
}
export {};
