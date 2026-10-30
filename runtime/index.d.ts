/**
 * Side-effect-only entry that installs JSON, selected ES5/ES6 and later compatibility methods, and applies four function corrections to the shared ExtendScript engine.
 *
 * ExtendScriptの共有エンジンへJSON・ES5・ES6と後年の一部メソッドの補完、4関数の互換補正を適用する副作用専用の入口。
 *
 * Method documentation is adapted from TypeScript 5.9.3 standard library declarations.
 * Copyright (c) Microsoft Corporation. Licensed under the Apache License, Version 2.0.
 * See THIRD-PARTY-LICENSES.txt for the license and source.
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
    /**
     * Determines whether an object has a property with the specified name.
     * @param o An object.
     * @param v A property name.
     *
     * @remarks ホスト固有オブジェクトなどの所有属性はホストの判定に依存します。
     */
    hasOwn(o: object, v: PropertyKey): boolean;
    /**
     * Returns an array of key/values of the enumerable own properties of an object
     * @param value Object that contains the properties and methods.
     *
     * @remarks 属性情報が取得できない環境では標準と異なる場合があります。
     */
    entries<T>(value: { [key: string]: T } | ArrayLike<T>): [string, T][];
    entries(value: {}): [string, any][];
    /**
     * Returns an array of values of the enumerable own properties of an object
     * @param value Object that contains the properties and methods.
     *
     * @remarks 属性情報が取得できない環境では標準と異なる場合があります。
     */
    values<T>(value: { [key: string]: T } | ArrayLike<T>): T[];
    values(value: {}): any[];
  }
  interface Array<T> {
    /**
     * Returns a copy of an array with its elements sorted.
     * @param compareFn Function used to determine the order of the elements. It is expected to return
     * a negative value if the first argument is less than the second argument, zero if they're equal, and a positive
     * value otherwise. If omitted, the elements are sorted in ascending, UTF-16 code unit order.
     * ```ts
     * [11, 2, 22, 1].toSorted((a, b) => a - b) // [1, 2, 11, 22]
     * ```
     */
    toSorted(compareFn?: (a: T, b: T) => number): T[];
    /**
     * Returns a copy of an array with its elements reversed.
     */
    toReversed(): T[];
    /**
     * Copies an array and removes elements while returning the remaining elements.
     * @param start The zero-based location in the array from which to start removing elements.
     * @param deleteCount The number of elements to remove.
     * @returns A copy of the original array with the remaining elements.
     */
    toSpliced(start: number, deleteCount?: number): T[];
    /**
     * Copies an array and removes elements and, if necessary, inserts new elements in their place. Returns the copied array.
     * @param start The zero-based location in the array from which to start removing elements.
     * @param deleteCount The number of elements to remove.
     * @param items Elements to insert into the copied array in place of the deleted elements.
     * @returns The copied array.
     */
    toSpliced(start: number, deleteCount: number, ...items: T[]): T[];
    /**
     * Returns the value of the last element in the array where predicate is true, and undefined
     * otherwise.
     * @param predicate findLast calls predicate once for each element of the array, in descending
     * order, until it finds one where predicate returns true. If such an element is found, findLast
     * immediately returns that element value. Otherwise, findLast returns undefined.
     * @param thisArg If provided, it will be used as the this value for each invocation of
     * predicate. If it is not provided, undefined is used instead.
     */
    findLast<S extends T>(
      predicate: (value: T, index: number, array: T[]) => value is S,
      thisArg?: any,
    ): S | undefined;
    findLast(
      predicate: (value: T, index: number, array: T[]) => unknown,
      thisArg?: any,
    ): T | undefined;
    /**
     * Returns the index of the last element in the array where predicate is true, and -1
     * otherwise.
     * @param predicate findLastIndex calls predicate once for each element of the array, in descending
     * order, until it finds one where predicate returns true. If such an element is found,
     * findLastIndex immediately returns that element index. Otherwise, findLastIndex returns -1.
     * @param thisArg If provided, it will be used as the this value for each invocation of
     * predicate. If it is not provided, undefined is used instead.
     */
    findLastIndex(
      predicate: (value: T, index: number, array: T[]) => unknown,
      thisArg?: any,
    ): number;
    /**
     * Returns the item located at the specified index.
     * @param index The zero-based index of the desired item. A negative index will count back from the last item.
     */
    at(index: number): T | undefined;
    /**
     * Determines whether an array includes a certain element, returning true or false as appropriate.
     * @param searchElement The element to search for.
     * @param fromIndex The position in this array at which to begin searching for searchElement.
     */
    includes(searchElement: T, fromIndex?: number): boolean;
    /**
     * Returns a new array with all sub-array elements concatenated into it recursively up to the
     * specified depth.
     *
     * @param depth The maximum recursion depth
     *
     * @remarks ExtendScriptでは省略要素の扱いが異なる場合があり、Symbol.speciesには対応しません。
     */
    flat<A, D extends number = 1>(this: A, depth?: D): ExtendScriptCompatFlatArray<A, D>[];
    /**
     * Calls a defined callback function on each element of an array. Then, flattens the result into
     * a new array.
     * This is identical to a map followed by flat with depth 1.
     *
     * @param callback A function that accepts up to three arguments. The flatMap method calls the
     * callback function one time for each element in the array.
     * @param thisArg An object to which the this keyword can refer in the callback function. If
     * thisArg is omitted, undefined is used as the this value.
     *
     * @remarks Symbol.speciesによる派生配列の生成には対応しません。
     */
    flatMap<U, This = undefined>(
      callback: (this: This, value: T, index: number, array: T[]) => U | ReadonlyArray<U>,
      thisArg?: This,
    ): U[];
  }
  interface ReadonlyArray<T> {
    /**
     * Copies and sorts the array.
     * @param compareFn Function used to determine the order of the elements. It is expected to return
     * a negative value if the first argument is less than the second argument, zero if they're equal, and a positive
     * value otherwise. If omitted, the elements are sorted in ascending, UTF-16 code unit order.
     * ```ts
     * [11, 2, 22, 1].toSorted((a, b) => a - b) // [1, 2, 11, 22]
     * ```
     */
    toSorted(compareFn?: (a: T, b: T) => number): T[];
    /**
     * Copies the array and returns the copied array with all of its elements reversed.
     */
    toReversed(): T[];
    /**
     * Copies an array and removes elements while returning the remaining elements.
     * @param start The zero-based location in the array from which to start removing elements.
     * @param deleteCount The number of elements to remove.
     * @returns A copy of the original array with the remaining elements.
     */
    toSpliced(start: number, deleteCount?: number): T[];
    /**
     * Copies an array and removes elements while, if necessary, inserting new elements in their place, returning the remaining elements.
     * @param start The zero-based location in the array from which to start removing elements.
     * @param deleteCount The number of elements to remove.
     * @param items Elements to insert into the copied array in place of the deleted elements.
     * @returns A copy of the original array with the remaining elements.
     */
    toSpliced(start: number, deleteCount: number, ...items: T[]): T[];
    /**
     * Returns the value of the last element in the array where predicate is true, and undefined
     * otherwise.
     * @param predicate findLast calls predicate once for each element of the array, in descending
     * order, until it finds one where predicate returns true. If such an element is found, findLast
     * immediately returns that element value. Otherwise, findLast returns undefined.
     * @param thisArg If provided, it will be used as the this value for each invocation of
     * predicate. If it is not provided, undefined is used instead.
     */
    findLast<S extends T>(
      predicate: (value: T, index: number, array: readonly T[]) => value is S,
      thisArg?: any,
    ): S | undefined;
    findLast(
      predicate: (value: T, index: number, array: readonly T[]) => unknown,
      thisArg?: any,
    ): T | undefined;
    /**
     * Returns the index of the last element in the array where predicate is true, and -1
     * otherwise.
     * @param predicate findLastIndex calls predicate once for each element of the array, in descending
     * order, until it finds one where predicate returns true. If such an element is found,
     * findLastIndex immediately returns that element index. Otherwise, findLastIndex returns -1.
     * @param thisArg If provided, it will be used as the this value for each invocation of
     * predicate. If it is not provided, undefined is used instead.
     */
    findLastIndex(
      predicate: (value: T, index: number, array: readonly T[]) => unknown,
      thisArg?: any,
    ): number;
    /**
     * Returns the item located at the specified index.
     * @param index The zero-based index of the desired item. A negative index will count back from the last item.
     */
    at(index: number): T | undefined;
    /**
     * Determines whether an array includes a certain element, returning true or false as appropriate.
     * @param searchElement The element to search for.
     * @param fromIndex The position in this array at which to begin searching for searchElement.
     */
    includes(searchElement: T, fromIndex?: number): boolean;
    /**
     * Returns a new array with all sub-array elements concatenated into it recursively up to the
     * specified depth.
     *
     * @param depth The maximum recursion depth
     *
     * @remarks ExtendScriptでは省略要素の扱いが異なる場合があり、Symbol.speciesには対応しません。
     */
    flat<A, D extends number = 1>(this: A, depth?: D): ExtendScriptCompatFlatArray<A, D>[];
    /**
     * Calls a defined callback function on each element of an array. Then, flattens the result into
     * a new array.
     * This is identical to a map followed by flat with depth 1.
     *
     * @param callback A function that accepts up to three arguments. The flatMap method calls the
     * callback function one time for each element in the array.
     * @param thisArg An object to which the this keyword can refer in the callback function. If
     * thisArg is omitted, undefined is used as the this value.
     *
     * @remarks Symbol.speciesによる派生配列の生成には対応しません。
     */
    flatMap<U, This = undefined>(
      callback: (this: This, value: T, index: number, array: T[]) => U | ReadonlyArray<U>,
      thisArg?: This,
    ): U[];
  }
  interface String {
    /**
     * Replace all instances of a substring in a string, using a regular expression or search string.
     * @param searchValue A string to search for.
     * @param replaceValue A string containing the text to replace for every successful match of searchValue in this string.
     *
     * @remarks 正規表現にはgフラグが必要です。正規表現エンジン自体の不具合は補いません。
     */
    replaceAll(searchValue: string | RegExp, replaceValue: string): string;
    /**
     * Replace all instances of a substring in a string, using a regular expression or search string.
     * @param searchValue A string to search for.
     * @param replacer A function that returns the replacement text.
     *
     * @remarks 正規表現にはgフラグが必要です。正規表現エンジン自体の不具合は補いません。
     */
    replaceAll(
      searchValue: string | RegExp,
      replacer: (substring: string, ...args: any[]) => string,
    ): string;
    /**
     * Returns true if all leading surrogates and trailing surrogates appear paired and in order.
     */
    isWellFormed(): boolean;
    /**
     * Returns a string where all lone or out-of-order surrogates have been replaced by the Unicode replacement character (U+FFFD).
     */
    toWellFormed(): string;
    /**
     * Returns a new String consisting of the single UTF-16 code unit located at the specified index.
     * @param index The zero-based index of the desired code unit. A negative index will count back from the last item.
     */
    at(index: number): string | undefined;
    /**
     * Pads the current string with a given string (possibly repeated) so that the resulting string reaches a given length.
     * The padding is applied from the start (left) of the current string.
     *
     * @param maxLength The length of the resulting string once the current string has been padded.
     *        If this parameter is smaller than the current string's length, the current string will be returned as it is.
     *
     * @param fillString The string to pad the current string with.
     *        If this string is too long, it will be truncated and the left-most part will be applied.
     *        The default value for this parameter is " " (U+0020).
     */
    padStart(maxLength: number, fillString?: string): string;
    /**
     * Pads the current string with a given string (possibly repeated) so that the resulting string reaches a given length.
     * The padding is applied from the end (right) of the current string.
     *
     * @param maxLength The length of the resulting string once the current string has been padded.
     *        If this parameter is smaller than the current string's length, the current string will be returned as it is.
     *
     * @param fillString The string to pad the current string with.
     *        If this string is too long, it will be truncated and the left-most part will be applied.
     *        The default value for this parameter is " " (U+0020).
     */
    padEnd(maxLength: number, fillString?: string): string;
    /** Removes the leading white space and line terminator characters from a string. */
    trimStart(): string;
    /** Removes the trailing white space and line terminator characters from a string. */
    trimEnd(): string;
    /**
     * Removes the leading white space and line terminator characters from a string.
     * @deprecated A legacy feature for browser compatibility. Use `trimStart` instead
     */
    trimLeft(): string;
    /**
     * Removes the trailing white space and line terminator characters from a string.
     * @deprecated A legacy feature for browser compatibility. Use `trimEnd` instead
     */
    trimRight(): string;
  }
}
export {};
