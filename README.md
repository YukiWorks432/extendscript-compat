# extendscript-compat

生成済みのJavaScriptへ括弧を挿入し、Adobe ExtendScriptの演算子優先順位による誤動作を防ぐ、ビルド時のライブラリです。混在する論理演算子と入れ子の三項演算子を対象にします。

## インストール

ビルド用の開発依存として追加します。

```sh
pnpm add -D extendscript-compat@0.1.0
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

各出力チャンクへ補正と検査を行い、既存の有効なソースマップを括弧の挿入位置に合わせて更新します。外部ファイル、inline、hiddenの形式に対応します。先行プラグインがコードを変更したのにソースマップを更新していない場合、その情報の復元はできません。CEP固有のinclude処理への対応は利用側の組み込み処理で行ってください。

## 対応範囲

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

## 開発

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm pack --pack-destination artifacts
```

試験では真偽値の組み合わせ、副作用の順序と回数、既存括弧、繰り返し適用、圧縮後の出力、ソースマップを確認します。実機での対応範囲と生成物の証跡はPRの検証結果に記録します。

MIT License。
