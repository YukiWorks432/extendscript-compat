# 開発用ファイルの配置

[English](development-layout.md) | 日本語（正本）

## 実装と配布

- src/: Node.jsで実行するビルド時の互換補正とRollup連携です。
- runtime-src/vendor/: 移植・改変した第三者コードです。取り込み元と変更点はランタイムのREADMEと第三者ライセンスを参照してください。
- runtime-src/polyfills/: Array・String・Objectごとの補完実装と既存関数の動作判定です。処理を共有するメソッドは同じファイルに置きます。
- runtime-src/polyfill-helpers.js: 数値・長さの変換とメソッド追加の共通処理です。
- runtime-src/install-polyfills.js: 適用順と適用済みの印を管理します。旧版と同じエンジンで使えるよう、既存の印を維持します。
- runtime-src/builtin-corrections.js・trim.js: ExtendScriptの組み込み関数に対する補正です。
- runtime/index.js: scripts/build-runtime.mjsで生成するES3・ASCIIの配布入口です。直接編集せず再生成してください。
- runtime/number.js・unit-value.jsと型宣言: 手書きの公開APIです。runtime/全体が生成物ではありません。

利用側の読み込み方は変更しません。

## 検証と履歴

test/runtime/は後年のAPIの結合テスト、test/contracts/はNodeとAEで共用する実行可能な契約検証、test/types/は型宣言の利用例です。test/fixtures/には入力資料と比較用の旧版を置きます。

docs/evidence/は過去に実行した検証の記録です。ES Nextの3段階の記録は2026-10-29/ae-26.5/以下にまとめています。ほかの既存記録の配置は維持しています。保存済みの実行コードを現在の配置へ合わせて書き換えたり、整形したりしないでください。絶対パスと実行対象の識別子も当時の記録です。

.jsx.txtは実行したコードを保存する拡張子です。そのまま再実行するための入口ではありません。JSONのsourceFileは同じフォルダのコードを指します。第3段階の記録のsha256はUTF-8の実行文字列を対象とし、保存ファイル末尾のLFを1個除いた内容に一致します。対象生成物や契約ファイルのハッシュとは区別してください。

## 確認

node scripts/build-runtime.mjsで再生成し、pnpm checkで生成物の一致・整形・静的検査・型検査・契約を確認します。scripts/build-host-*.mjsはtmp/へ検証出力を作ります。配置変更だけで、過去の実機結果を新しい生成物の検証済み証跡として扱わないでください。
