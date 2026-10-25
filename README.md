# extendscript-compat

生成済みのJavaScriptへ括弧を挿入し、Adobe ExtendScriptの演算子優先順位による誤動作を防ぐ、ビルド時のライブラリです。混在する論理演算子と入れ子の三項演算子を対象にします。

現在は非公開リポジトリでの開発段階です。npmには未登録で、package.jsonのprivateを有効にしています。登録の計画と操作方法は[公開計画](docs/npm-publication.md)を参照してください。

## 使用例

Node.js 22以降で動作します。Babelを解析に使いますが、コード全体を再生成せず、元の文字列へ括弧だけを挿入します。

```js
import {
  protectExtendscriptExpressionPrecedence,
  assertExtendscriptExpressionPrecedenceProtected,
} from "extendscript-compat";

const result = protectExtendscriptExpressionPrecedence(
  "var value = a || b && c; var other = a ? b : c ? d : e;",
);
// var value = a || (b && c); var other = a ? b : (c ? d : e);
assertExtendscriptExpressionPrecedenceProtected(result.code);
```

protectExtendscriptExpressionPrecedenceは補正後のcodeと、元の文字列に対する括弧1文字ごとの挿入位置insertionsを返します。同じコードへ繰り返し適用しても、括弧を追加し続けません。

findUnprotectedExtendscriptExpressionPrecedenceは、未保護箇所の種類・文字位置・行・列を返します。行は1始まり、列と文字位置は0始まりです。公開する診断情報にはBabelのAST型を含めません。

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

## 開発

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm pack --pack-destination artifacts
```

試験では真偽値の組み合わせ、副作用の順序と回数、既存括弧、繰り返し適用、圧縮後の出力、ソースマップを確認します。実機での対応範囲と生成物の証跡はPRの検証結果に記録します。

MIT License。
