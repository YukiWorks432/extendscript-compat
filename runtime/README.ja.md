# 組み込み関数の互換補正

[English](README.md) | 日本語（正本）

`extendscript-compat/runtime`は、JSONとES5・ES6の一部を補完し、`parseInt`、`String.prototype.charAt`、`split`、`replace`の不具合を補正する副作用専用の入口です。4関数は存在する場合も置き換えます。

## 導入と読み込み順

アプリケーションや依存ライブラリの初期化前に読み込んでください。JSON、ES5、ES6の順に補完し、その後に4関数を補正します。別の互換コードを併用する場合も、最後の互換補正として読み込んでください。

```js
import "extendscript-compat/runtime";
```

Rollupで通常のホスト用JavaScriptへまとめ、圧縮やinclude展開の後に`extendscriptCompat()`を適用してください。引用した互換コード自身も優先順位保護の対象です。Node.js用の通常入口と`/rollup`は、この実行時補正を自動では読み込みません。

`runtime/index.js`をそのままJSXへ含めることもできます。コードはES3構文で記述しており、Adobeでは`$.global`へ適用します。Node.jsで明示的に読み込んだ場合は`globalThis`が対象です。

同じエンジンを利用する別のスクリプトにも補正が及びます。適用前に別の変数へ保存された関数への参照は変わりません。同じエンジンでの再評価は内部の版付き印で省略し、関数を重ねて包みません。後から別のライブラリが対象関数を書き換えた場合、その書き換えを監視したり自動で取り消したりはしません。

## 補正する挙動

| 対象             | 補正内容                                                                                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EC-04 / parseInt | 基数11〜36と自動判定の16進数で、無効な記号を数字として読まないようにします。有効な数字部分だけを元の数値解析へ渡し、型変換は一度ずつ行います。基数省略時の旧8進数解釈と基数10以下の挙動は元の関数を維持します。 |
| EC-05 / charAt   | NUL文字も長さ1の文字列として返します。範囲外は空文字列、位置はUTF-16のコード単位です。                                                                                                                          |
| EC-07 / split    | 正規表現で分割した末尾の空要素を保持します。キャプチャ、空一致、分割数の上限、呼び出し元のlastIndexを扱います。                                                                                                 |
| EC-08 / replace  | 未参加キャプチャを空文字列にし、置換文字列のドル記号・一致全体・前後の文脈・1〜99番のキャプチャを展開します。コールバックにも元の入力と位置を渡します。                                                         |

AE固有の挙動として、グローバルな正規表現が空の入力に一致しない問題をsplit内で補っています。replaceでは、文字列検索でコールバックが実行されない問題、連続置換時に途中の結果がコールバックへ渡る問題、末尾の空一致が省略される問題も補っています。

移行元のテンプレートと同様に、JSON、`Array.prototype.map`、`Object.keys`、`Array.from`などを補完します。JSONの既存実装が変換用コールバックを無視する場合も補完版へ置き換えます。補完版の`JSON.parse`は検査後に`eval`を使い、末尾のカンマなど一部の不正なJSONを受け入れるため、厳密な入力検証には使えません。ES5・ES6のすべてを保証するものではなく、`Symbol`や`Promise`は対象外です。正規表現エンジン自体のキャプチャ消失・停止にも対応しません。UnitValueの演算や厳密比較も対象外のため、以下の明示的な補助APIを使ってください。後年の正規表現フラグや名前付きキャプチャも対象にしません。JavaScriptで実装したメソッドの関数オブジェクトや、非strictモードのES3における`call(null)` / `call(undefined)`のthis変換は、純正関数と完全には同じになりません。

## UnitValueの明示的な補助API

`extendscript-compat/unit-value`は、副作用を持たない別の入口です。ESモジュールとしてホスト用バンドルへ含め、圧縮後にextendscriptCompat()を適用してください。ファイルをそのままJSXのincludeへ渡す用途には対応しません。

```js
import { subtractUnitValues, isNull } from "extendscript-compat/unit-value";

var input = new UnitValue("20 px");
input.baseUnit = new UnitValue(1 / 96, "in");
var result = subtractUnitValues(10, input);
// result.valueは-10、result.typeはpx、result.as("in")は-10/96です。
if (!isNull(result)) {
  // UnitValueのまま利用できます。
}
```

たとえば、右辺が2 inの場合は、次のように数値との差を求められます。

```js
import { subtractUnitValues, isNull } from "extendscript-compat/unit-value";

var value = new UnitValue("2 in");
var difference = subtractUnitValues(10, value);
// differenceは8 in。入力のvalueは変更しません。
var missing = isNull(value); // false
```

| API                             | 契約                                                                                                                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| subtractUnitValues(left, right) | 引数は数値またはホストのUnitValueです。数値−UnitValueだけを補正し、新しい純正のUnitValueへ右辺の単位とbaseUnitを引き継ぎます。入力は変更しません。その他の組み合わせは純正の減算を使います。数値以外の型変換は行わず、不正な引数はTypeErrorにします。 |
| isNull(value)                   | UnitValueにはfalseを返し、それ以外はnullとの厳密比較を使います。絶対値が1未満のUnitValueもnullとして扱いません。UnitValue以外の独自クラスの演算子上書きまで正常化するAPIではありません。                                                              |

型宣言の`UnitValueLike`は、補助APIに必要な公開部分を表します。実行時にはホストのUnitValueかどうかを確認するため、構造が似た通常のオブジェクトを減算の引数にはできません。純正コンストラクタが持つNaNや無限値の表現は、そのままホストに従います。

AEでは、元の演算子を取得した後にインスタンスの演算子を上書きしても反映されない例がありました。プロトタイプの変更でも新規インスタンスを修正できませんでした。このため、元のクラスを維持できる明示的な補助APIを採用しています。`/runtime`の読込で通常の演算子や比較が直るとは保証しません。

## 取り込み元と変更

splitは、MITライセンスの[es5-shim v4.6.7](https://github.com/es-shims/es5-shim/blob/c0867fc232177277f2f74c6066aad47ade51076c/es5-shim.js#L1980-L2076)を取り込んでいます。元コミットは`c0867fc232177277f2f74c6066aad47ade51076c`です。[著作権表示と許諾文](../THIRD-PARTY-LICENSES.txt)を同梱しています。

元実装から、ES3用のフラグ、対象関数の強制置換、共有エンジンでの再評価防止、入力の一度だけの型変換、AEの空入力への対応を変更しました。文字列区切りのsplitは元の関数へ委ねます。元実装が持つ未参加キャプチャの補正も保持しています。

parseInt・charAt・replaceは、この調査で確認したExtendScript固有の不具合に合わせた実装です。es5-shimのparseIntは元の関数へ委譲するためEC-04を直せず、replaceの既存補正も今回の置換文字列の問題を覆わないため、そのままは採用していません。

[extendscript-ts-templateの固定コミット](https://github.com/YukiWorks432/extendscript-ts-template/tree/5fdc02dc818f8263a368166c180b9e4ed93a9453)からJSON、ES5、ES6の補完を移植しています。共有エンジンでの再評価防止と空白処理の改変を引き継ぎ、ES5の未定義だった空白判定値とES6のグローバル取得を補正しました。無効だったESNext補完は含めていません。各コードの著作権表示と許諾文は[第三者ライセンス](../THIRD-PARTY-LICENSES.txt)に記載しています。`runtime/index.js`は内部ソースから生成したES3コードです。リポジトリの作業コピーでは`node scripts/build-runtime.mjs`で再生成できます。

## 検証

`test/fixtures/runtime-contract.js`は、仕様から求めた期待値と実際の動作を比べる71項目の実機・Node共用資料です。製品の型検査対象とは分け、NodeとAEで実行します。

```sh
pnpm check
node scripts/build-host-runtime-probe.mjs
```

後者は`tmp/runtime-host-probe/`へ圧縮・優先順位保護した実出力、AE用の比較コード、SHA-256を生成します。AE用コードは適用前・適用後・再適用後を比較し、finallyで元の4関数と内部の印を復元します。通常の製品への導入は補正を保持するため、この復元処理を含めません。

実行結果は対象の製品版・エンジン版・コードのSHA-256とともに保存してください。今回確認したAEの結果と証跡は、リポジトリの[実機検証記録](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/runtime-host-validation.ja.md)に記録しています。他のAdobe製品では実機確認していません。
