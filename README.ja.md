# extendscript-compat

[English](README.md) | 日本語（正本）

Adobe ExtendScript向けに、ビルド時の不具合補正と実行時の互換機能を提供するライブラリです。

- 式の優先順位、`switch`をまたぐ`continue`、正規表現のハイフンをビルド時に補正します。
- 明示的な読み込みにより、JSON・ES5・ES6と後年の一部メソッドを補完し、`parseInt`と3つの文字列メソッドを実行時に補正します。
- `UnitValue`の減算と`null`比較には、明示的な補助APIを提供します。

## インストール

Node.js 22以降が必要です。

```sh
pnpm add -D extendscript-compat
```

## Rollupへの組み込み

Rollup 4のホスト用ビルドで、圧縮・include展開・互換コードの追加後、JSXBin化の前に配置します。

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

後続の生成器や圧縮器が括弧を除去すると、優先順位の保護は失われます。直接利用できるAPIや補正の条件は[ビルド時の互換補正](docs/build-compatibility.ja.md)を参照してください。

## 実行時の補正

アプリケーションや依存ライブラリの初期化前に読み込みます。JSON・ES5・ES6と後年の一部メソッドの補完、および4関数の不具合補正を適用します。

```js
import "extendscript-compat/runtime";
```

この入口は組み込み機能を追加・置換し、同じエンジンを使う他のスクリプトにも影響します。`UnitValue`の演算や比較は自動では補正されないため、`subtractUnitValues`と`isNull`を該当箇所で使ってください。読み込み順と制限は[実行時の互換補正](runtime/README.ja.md)を参照してください。

## 対応範囲と文書

入力は通常のJavaScriptとして生成されたコードです。TypeScriptからJavaScriptへの変換や、ES3互換の構文への変換は別途必要です。E4Xや未展開のプリプロセッサー指示を含む生のJSXは対象外です。

実機確認はAfter Effects 26.5x89 / ExtendScript 4.5.6で行っています。IllustratorやPhotoshopなど、他のAdobe製品では確認していません。

- [ビルド時の補正・診断とAPI](docs/build-compatibility.ja.md)
- [実行時補正とUnitValueの補助API](runtime/README.ja.md)
- [追加互換補正の実機検証](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/compatibility-host-validation.ja.md)・[組み込み関数の実機検証](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/runtime-host-validation.ja.md)
- [npm公開手順](https://github.com/YukiWorks432/extendscript-compat/blob/main/docs/npm-publication.ja.md)

日本語版が文書の正本で、英語版をGitHubとnpmで最初に表示します。内容に差異がある場合は日本語版を優先し、文書の変更時には対応する英語版も同じ変更で更新します。型定義の説明は英語を先頭に、日本語の正本を続けます。

MIT License。
