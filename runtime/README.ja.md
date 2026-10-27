# 組み込み関数の互換補正

[English](README.md) | 日本語（正本）

`extendscript-compat/runtime`は、読み込んだエンジンの`parseInt`、`String.prototype.charAt`、`split`、`replace`を置き換える、副作用専用の入口です。関数が存在する場合も補正を適用します。

## 導入と読み込み順

es5-shimなど既存の互換コードの後、アプリケーションや依存ライブラリの初期化前に読み込んでください。

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

AEの追加差として、globalな正規表現が空の入力へ一致しない問題をsplit内で補っています。replaceでは、文字列検索でコールバックが実行されない問題、連続置換時に途中の結果がコールバックへ渡る問題、末尾の空一致が省略される問題も補っています。

ES5メソッドの新規追加、正規表現エンジン自体のキャプチャ消失・停止、UnitValueの演算や厳密比較は、この副作用専用の入口の対象外です。下記の明示的な補助APIで扱います。後年の正規表現フラグや名前付きキャプチャも対象にしません。JavaScriptで実装したメソッドの関数オブジェクトや、非strictなES3における`call(null)` / `call(undefined)`のthis変換は純正関数と完全には同じになりません。

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

| API                             | 契約                                                                                                                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| subtractUnitValues(left, right) | 引数は数値またはホストのUnitValueです。数値−UnitValueだけを補正し、新しい純正のUnitValueへ右辺の単位とbaseUnitを引き継ぎます。入力は変更しません。その他の組み合わせは純正の減算を使います。数値以外の型変換は行わず、不正な引数はTypeErrorにします。 |
| isNull(value)                   | UnitValueにはfalseを返し、それ以外はnullとの厳密比較を使います。UnitValue以外の独自クラスの演算子上書きまで正常化するAPIではありません。                                                                                                              |

型宣言のUnitValueLikeは必要な公開部分を表します。実行時にはホストのUnitValueかどうかを確認するため、型の構造が似た通常のオブジェクトは減算の入力にできません。純正コンストラクタが持つNaNや無限値の表現は、そのままホストに従います。

AEでは、元の演算子を取得した後にインスタンスの演算子を上書きしても反映されない例がありました。プロトタイプの変更でも新規インスタンスを修正できませんでした。このため0.2.0では、元のクラスを維持できる明示的な補助APIを採用します。`/runtime`の読込で通常の演算子や比較が直るとは保証しません。

## 取り込み元と変更

splitは、MITライセンスの[es5-shim v4.6.7](https://github.com/es-shims/es5-shim/blob/c0867fc232177277f2f74c6066aad47ade51076c/es5-shim.js#L1980-L2076)を取り込んでいます。元コミットは`c0867fc232177277f2f74c6066aad47ade51076c`です。[著作権表示と許諾文](../THIRD-PARTY-LICENSES.txt)を同梱しています。

元実装から、ES3用のフラグ、対象関数の強制置換、共有エンジンでの再評価防止、入力の一度だけの型変換、AEの空入力への対応を変更しました。文字列区切りのsplitは元の関数へ委ねます。元実装が持つ未参加キャプチャの補正も保持しています。

parseInt・charAt・replaceは、この調査で確認したExtendScript固有の不具合に合わせた実装です。es5-shimのparseIntは元の関数へ委譲するためEC-04を直せず、replaceの既存補正も今回の置換文字列の問題を覆わないため、そのままは採用していません。

参考にした[extendscript-ts-template](https://github.com/YukiWorks432/extendscript-ts-template/tree/473d32798631aba0926e0bf094557e8b84c2f5ff)には、es5-shimの共有エンジン用キャッシュと空白処理の改変があります。[Issue #1と対応コメント](https://github.com/YukiWorks432/extendscript-ts-template/issues/1)を踏まえ、今回のparseIntはUnicodeの空白をまとめた正規表現を生成せず、文字コードで判定しています。同テンプレートから実装を複製したり、テンプレート本体を変更したりはしていません。

## 検証

`test/fixtures/runtime-contract.js`は、仕様から求めた期待値と実際の動作を比べる71項目の実機・Node共用資料です。製品の型検査対象とは分け、NodeとAEで実行します。

```sh
pnpm check
node scripts/build-host-runtime-probe.mjs
```

後者は`tmp/runtime-host-probe/`へ圧縮・優先順位保護した実出力、AE用の比較コード、SHA-256を生成します。AE用コードは適用前・適用後・再適用後を比較し、finallyで元の4関数と内部の印を復元します。通常の製品への導入は補正を保持するため、この復元処理を含めません。

実行結果は対象の製品版・エンジン版・コードのSHA-256とともに保存してください。今回確認したAEの結果と証跡は、リポジトリの[実機検証記録](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/runtime-host-validation.ja.md)に記録しています。他のAdobe製品では実機確認していません。
