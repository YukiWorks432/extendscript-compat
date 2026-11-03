# 実行時API対応表

[English](API-COMPATIBILITY.md) | 日本語（正本）

この表は`extendscript-compat/runtime`が扱う組み込みAPIを、2026年11月4日時点の同梱実装に基づいて整理したものです。使用前に`/runtime`を読み込んでください。標準ライブラリの型が存在するだけでは、実行時にそのAPIが存在することを意味しません。

「補完」は不足時の追加または不完全な既存実装の置換を試みることを示し、あらゆるホストや入力での標準準拠を保証するものではありません。「条件付き」は元の機能やホストの属性操作などを必要とします。表にないAPIを使用可能と判断しないでください。第三者の補完コードを併用する場合はその提供範囲と読み込み順を別途確認してください。

## JSONと実行時補正

| API                                           | ランタイムの扱い     | 制約                                                                                  |
| --------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| `JSON.parse`                                  | 補完・既存実装の判定 | JSON文法外の入力を拒否します。データ構造・値域の検証は利用側で行います                |
| `JSON.stringify`                              | 補完・既存実装の判定 | 置換関数の入れ子呼び出しと配列指定を扱います                                          |
| `parseInt`                                    | 既存関数も補正       | 基数11〜36と16進数の不正文字を補正します。旧8進数扱いなどは維持します                 |
| `String.prototype.charAt`、`split`、`replace` | 既存関数も補正       | 特定のNUL・末尾・置換の不具合が対象です。正規表現エンジン全体は補正しません           |
| `String.prototype.trim`                       | 補完・既存実装の判定 | 現行の空白と改行を扱います                                                            |
| `Number.parseInt`                             | 補完・補正           | 補正後のグローバル`parseInt`と同じ関数です                                            |
| `Number(value)`                               | 自動補正の保証なし   | AE 26.5では置換できません。必要なら`extendscript-compat/number`の`toNumber`を使います |
| `UnitValue`の減算・null比較                   | 自動補正の対象外     | 必要なら`extendscript-compat/unit-value`の`subtractUnitValues`・`isNull`を使います    |

## ES5・ES2015の補完と条件

次のAPIは移植した互換コードの追加・補正対象です。行ごとに「実機確認済み」とは扱わず、下の検証範囲を参照してください。

| 対象               | API                                                                                                                                                                                           | 扱い・注意                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Function.prototype | `bind`                                                                                                                                                                                        | 補完                                                                                         |
| Array              | `isArray`                                                                                                                                                                                     | 補完                                                                                         |
| Array.prototype    | `forEach`、`map`、`filter`、`every`、`some`、`reduce`、`reduceRight`、`indexOf`、`lastIndexOf`                                                                                                | 補完                                                                                         |
| Array.prototype    | `unshift`、`splice`、`join`、`push`、`slice`、`sort`                                                                                                                                          | 既存実装の特定の不具合に対する条件付き補正                                                   |
| Object             | `keys`                                                                                                                                                                                        | 補完・条件付き補正                                                                           |
| Date               | `now`、`parse`                                                                                                                                                                                | 補完・条件付き補正。ホストのDate実装に依存します                                             |
| Date.prototype     | `getFullYear`、`getMonth`、`getDate`、`getUTCFullYear`、`getUTCMonth`、`getUTCDate`、`toString`、`toUTCString`、`toDateString`、`toISOString`、`toJSON`                                       | 特定の不具合を条件付きで補正・補完                                                           |
| Number.prototype   | `toFixed`、`toExponential`、`toPrecision`                                                                                                                                                     | 特定の不具合を条件付きで補正・補完                                                           |
| String.prototype   | `substr`、`lastIndexOf`                                                                                                                                                                       | 特定の不具合を条件付きで補正                                                                 |
| String             | `fromCodePoint`、`raw`                                                                                                                                                                        | 補完                                                                                         |
| String.prototype   | `repeat`、`startsWith`、`endsWith`、`includes`、`codePointAt`                                                                                                                                 | 補完・条件付き補正                                                                           |
| Array              | `from`、`of`                                                                                                                                                                                  | 補完。反復子を伴う入力はホストの機能にも依存します                                           |
| Array.prototype    | `copyWithin`、`fill`、`find`、`findIndex`、`keys`、`values`、`entries`                                                                                                                        | 補完。反復子を使う処理はホストの機能にも依存します                                           |
| Number             | `MAX_SAFE_INTEGER`、`MIN_SAFE_INTEGER`、`EPSILON`、`parseFloat`、`isFinite`、`isInteger`、`isSafeInteger`、`isNaN`                                                                            | 補完                                                                                         |
| Object             | `assign`、`is`                                                                                                                                                                                | 補完・条件付き補正                                                                           |
| Math               | `acosh`、`asinh`、`atanh`、`cbrt`、`clz32`、`cosh`、`expm1`、`hypot`、`log2`、`log10`、`log1p`、`sign`、`sinh`、`tanh`、`trunc`、`imul`、`fround`                                             | 補完・条件付き補正                                                                           |
| Object             | `defineProperty`、`setPrototypeOf`                                                                                                                                                            | 条件付き処理。属性操作などの基礎機能が必要です                                               |
| Reflect            | `apply`、`construct`、`deleteProperty`、`has`、`ownKeys`、`isExtensible`、`preventExtensions`、`defineProperty`、`getOwnPropertyDescriptor`、`get`、`set`、`getPrototypeOf`、`setPrototypeOf` | 条件付き処理。属性操作などの基礎機能が必要なものがあり、AEで全面的に利用可能とは保証しません |

## 後年のメソッド

これらのAPIは不足・不完全な場合に補完し、`/runtime`の型宣言も追加します。`Array`の型宣言は`ReadonlyArray`にも対応します。

| 対象             | API                                                                         | 主な制約                                                                                                   |
| ---------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Array.prototype  | `includes`、`at`、`findLast`、`findLastIndex`                               | `at`の負の位置、末尾検索の穴を扱います                                                                     |
| Array.prototype  | `flat`、`flatMap`                                                           | AEの配列リテラルの省略要素と`delete`による穴は異なります。`Symbol.species`による派生配列の生成は対象外です |
| Array.prototype  | `toSorted`、`toReversed`、`toSpliced`                                       | 新しい通常配列を返します。コピー先の属性設定が使えない環境では代入します                                   |
| Object           | `entries`、`values`、`hasOwn`                                               | ホスト固有オブジェクトや属性情報を取得できない場合はホストの挙動に依存します                               |
| String.prototype | `at`、`padStart`、`padEnd`、`trimStart`、`trimEnd`、`trimLeft`、`trimRight` | `at`はUTF-16のコード単位です                                                                               |
| String.prototype | `replaceAll`、`isWellFormed`、`toWellFormed`                                | `replaceAll`の正規表現には`g`が必要です。正規表現エンジン自体は補完しません                                |

詳細な挙動と制限は[実行時の互換補正](README.ja.md)を参照してください。

## 補完対象外・未確認の例

| API                                                                         | 状態                                                                                   |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Promise`、`Symbol`                                                         | 補完対象外です                                                                         |
| `Map`、`Set`、`WeakMap`、`WeakSet`、`Proxy`                                 | このランタイムにコンストラクターの補完はありません。ホストや別の補完コードに依存します |
| `Object.fromEntries`、`Array.prototype.with`                                | このランタイムに補完はありません。利用可能かはホストや別の補完コードに依存します       |
| `String.prototype.matchAll`、`Object.getOwnPropertyDescriptors`             | このランタイムに補完はありません。利用可能かはホストや別の補完コードに依存します       |
| `BigInt`、`WeakRef`、`FinalizationRegistry`、`SharedArrayBuffer`、`Atomics` | このランタイムに補完はありません。利用可能かはホストや別の補完コードに依存します       |
| 正規表現の新しいフラグ・名前付きキャプチャ                                  | 正規表現エンジンの補完対象外です                                                       |

この一覧はES2022全APIの可否一覧ではありません。上記以外の未調査APIやホスト固有のAPIは未確認です。

## 検証範囲と根拠

保存済みの実機検証はAfter Effects 26.5x89 / ExtendScript 4.5.6（build 80.1060872）です。JSON、`Array.prototype.map`・`filter`・`reduce`、`Array.isArray`、`Object.keys`、`Function.prototype.bind`、`trim`、`Array.from`・`of`、`find`・`findIndex`、`startsWith`・`endsWith`、`Number.isFinite`、`Object.assign`、`Math.trunc`などの代表例を確認しています。後年のメソッドやJSONの境界条件も個別の契約で確認しています。

各試験の導入状態と対象生成物は異なります。保存済みの[実行時の実機検証記録](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/runtime-host-validation.ja.md)を確認してください。JSONの解析・出力はIllustrator 30.8.2 / ExtendScript 4.5.6とPhotoshop 27.11.0 / ExtendScript 4.5.12でも個別検証しました。最終版の全機能を新規エンジンへ初回導入した状態、古いAE、Illustrator・PhotoshopのJSON以外の機能は未確認です。Nodeでの検証はAdobe実機の検証とは区別します。

実装の確認先は[`runtime-src/vendor/es5-shim.js`](https://github.com/YukiWorks432/extendscript-compat/blob/f68f5d6c77b10ef2c2a7a06d9a45db14c89cc894/runtime-src/vendor/es5-shim.js)、[`es6-shim.js`](https://github.com/YukiWorks432/extendscript-compat/blob/f68f5d6c77b10ef2c2a7a06d9a45db14c89cc894/runtime-src/vendor/es6-shim.js)、[後年のメソッドの導入処理](https://github.com/YukiWorks432/extendscript-compat/blob/f68f5d6c77b10ef2c2a7a06d9a45db14c89cc894/runtime-src/install-polyfills.js)です。

Object.entriesとObject.valuesは、属性情報を取得できない環境でも文字列のUTF-16添字を直接補います。Object.keysが文字列の添字を省略するPremiereでも文字を取得し、文字列オブジェクトに追加された列挙可能なプロパティも保持します。
