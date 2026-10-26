# extendscript-compat

Adobe ExtendScriptの既知の不具合を、ビルド時の補正・診断と明示的な実行時APIで扱うライブラリです。式の優先順位、正規表現のハイフン、switchをまたぐcontinue、組み込み文字列処理とUnitValueを対象にします。

## インストール

ビルド用の開発依存として追加します。0.2.0は公開準備中です。公開前の検証には、この版のコミットから作成したtarballを使ってください。

```sh
pnpm add -D extendscript-compat@0.2.0
```

## 使用例

Node.js 22以降で動作します。Babelを解析に使いますが、コード全体を再生成せず、元の文字列へ括弧だけを挿入します。

```js
import { protectPrecedence, assertPrecedenceProtected } from "extendscript-compat";

const result = protectPrecedence("var value = a || b && c; var other = a ? b : c ? d : e;");
// var value = a || (b && c); var other = a ? b : (c ? d : e);
assertPrecedenceProtected(result.code);
```

protectPrecedenceは補正後のcodeと、元の文字列に対する括弧1文字ごとの挿入位置insertionsを返します。同じコードへ繰り返し適用しても、括弧を追加し続けません。

findPrecedenceIssuesは、未保護箇所の種類・文字位置・行・列を返します。行は1始まり、列と文字位置は0始まりです。公開する診断情報にはBabelのAST型を含めません。

## Rollupへの組み込み

Rollup 4のホスト用ビルドに追加します。圧縮、include展開、互換コードの追加が完了した後、JSXBinへ変換する前に配置してください。後続の生成器や圧縮器が括弧を除去すると、保護は失われます。

```js
import { extendscriptCompat } from "extendscript-compat/rollup";

export default {
  input: "src/index.js",
  output: { file: "dist/script.jsx", format: "iife", sourcemap: true },
  plugins: [
    // Babel、Terser、include展開など
    extendscriptCompat(),
    // 必要ならJSXBin化
  ],
};
```

各出力チャンクへ補正と検査を行い、既存の有効なソースマップを括弧・セミコロンの挿入と正規表現の置換に合わせて更新します。外部ファイル、inline、hiddenの形式に対応します。先行プラグインがコードを変更したのにソースマップを更新していない場合、その情報の復元はできません。CEP固有のinclude処理への対応は利用側の組み込み処理で行ってください。

## 対応範囲

protectPrecedenceは従来どおり括弧だけを挿入します。protectCompatibilityとRollup用のextendscriptCompatは、下記のEC-03・EC-06も扱います。

入力は通常のJavaScriptとして生成されたコードです。TypeScriptの変換やES3構文への変換は、Babelなど既存のビルド処理へ委ねます。ExtendScript固有のE4Xや未展開のプリプロセッサー指示を含む生のJSXファイルは対象にしません。構文解析に失敗した場合は例外を返し、無変換のまま成功扱いにはしません。

混在する&&と||の境界、および三項演算子の条件部・真側・偽側に直接入れ子になった三項演算子を括弧で保護します。値、短絡評価、this、arguments、evalから見える束縛を保ち、関数や一時変数を追加しません。JSON実装、文字コード、Adobe製品APIなどの検査は利用側で行ってください。

After Effects 26.5x89 / ExtendScript 4.5.6で言語回帰22件と利用側の製品回帰96件を確認しています。IllustratorやPhotoshopなど、ほかの製品での実機確認は行っていません。

## 関連する実装

同じ不具合への対処は既存のツールにもあります。2026年10月26日時点で、次の実装を確認しました。

- [babel-preset-extendscript](https://github.com/fusepilot/babel-preset-extendscript): Babelのプリセットとして、入れ子の三項演算子を括弧で囲みます。多くの構文変換や互換機能も含みます。
- [UglifyJS](https://github.com/mishoo/UglifyJS#output-options): `output.extendscript: true` で入れ子の三項演算子を保護します。npmの3.19.3で、`a || b && c` への括弧追加は行われないことを確認しました。
- [extendscript-minimizer](https://github.com/gmeeker/extendscript-minimizer/blob/master/transforms/transform.precedence.js): Closure Compilerとjscodeshiftを使うツールで、両方の不具合を明示的な括弧で保護します。今回の調査時点ではnpmの同名パッケージを取得できませんでした。

extendscript-compatは生成済みコードへの括弧挿入、診断・検査API、Rollupでのソースマップ更新をまとめて提供します。既存の変換処理や圧縮器と組み合わせ、生成処理の最後に組み込む用途を想定しています。

## 組み込み関数の実行時補正

必要なホスト用バンドルで、既存のes5-shimなどの後、利用するコードの前に読み込みます。

```js
import "extendscript-compat/runtime";
```

EC-04・05・07・08に対応し、parseInt、String.prototype.charAt・split・replaceを既存の関数がある場合も置き換えます。同じエンジンのほかのスクリプトにも影響します。共有エンジンでの再評価を防ぎ、通常のNode.js用入口とRollup用入口は変更しません。型変換・分割数・置換文字列・コールバックを含む利用範囲と制限は[実行時補正の説明](runtime/README.md)を参照してください。

splitにはes5-shim v4.6.7の実装を取り込み、ExtendScript向けの補正を加えています。[第三者ライセンス](THIRD-PARTY-LICENSES.txt)を同梱します。

## EC-03・EC-06のビルド時補正と診断

0.2.0では、RollupのextendscriptCompat()が優先順位保護に加え、次を行います。

- EC-03: switchをまたいで外側のループへ進む、ラベルのないcontinueを通知します。内側のループのcontinueとラベル付きcontinueは警告しません。対象ループへラベルを付けて回避してください。圧縮後に省かれたラベル付きcontinueの末尾のセミコロンは自動で補います。
- EC-06: g・i・mのみを使う正規表現リテラルの文字クラス内で、`\x2D`・`\u002D`を`\-`へ置き換えます。小文字の16進数字にも対応します。動的なRegExpコンストラクタの文字列や、文字クラス外のエスケープは変更しません。

EC-03の通知は既定で警告です。CIで手動対応を必須にする場合は停止を選べます。

```js
extendscriptCompat({ diagnostics: "error" });
// "warn": 警告（既定値）、"error": ビルド停止、"off": 通知を省略
```

ビルドツールへ直接組み込む場合は、統合APIを使います。

```js
import { findCompatibilityIssues, protectCompatibility } from "extendscript-compat";

const result = protectCompatibility(source);
// result.code: 優先順位・EC-06・ラベル付きcontinueのセミコロンを補正したコード
// result.edits: 元の入力に対する挿入と置換（start / end / text）
// result.diagnostics: 自動補正できないEC-03の診断
const issues = findCompatibilityIssues(source);
```

findCompatibilityIssuesは補正前のEC-03・EC-06を返します。各診断はcode、kind、start、end、line、column、messageを持ちます。行は1始まり、列と文字位置はUTF-16のコード単位で0始まりです。統合APIのeditsと診断の位置はいずれも元の入力を指します。正規表現のsourceやtoString()には補正後の表記が現れます。照合する文字集合は維持します。

## EC-10・EC-11のUnitValue補助API

ホスト用のコードから明示的に呼び出します。

```js
import { subtractUnitValues, isNull } from "extendscript-compat/unit-value";

var value = new UnitValue("2 in");
var difference = subtractUnitValues(10, value);
// differenceは8 in。入力のvalueは変更しません。
var missing = isNull(value); // false
```

subtractUnitValuesは数値−UnitValueの向きを補正し、純正のUnitValueを返します。結果の単位と換算基準baseUnitは右辺から引き継ぎます。数値同士、UnitValue−数値、UnitValue同士は純正の減算へ委ねます。引数は数値または実際のホストのUnitValueに限定し、文字列や構造だけが似たオブジェクトはTypeErrorになります。

isNullはUnitValueを先に区別するため、絶対値1未満のUnitValueもnullとして扱いません。これらのAPIはコンストラクタ、プロトタイプ、既存の演算子を上書きしません。通常の`10 - value`や`value === null`は自動では補正されません。型が実行時にしか分からない全ての式を一律に書き換える方式も採用していません。`/runtime`の読込だけではこの2件は補正されないため、該当箇所で補助APIを使ってください。

詳細は[実行時補正の説明](runtime/README.md)を参照してください。

## 開発

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm pack --pack-destination artifacts
```

試験では真偽値の組み合わせ、副作用の順序と回数、既存括弧、繰り返し適用、圧縮後の出力、ソースマップを確認します。実機での対応範囲と生成物の証跡はPRの検証結果に記録します。

MIT License。
