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

保存済みの実行コードは.jsxとして保管します。保存専用ディレクトリ内の記録であり、そのまま再実行するための入口ではありません。整形と静的検査の対象から除外して、実行時の内容を保持します。JSONのsourceFileは同じフォルダのコードを指します。第3段階の記録のsha256はUTF-8の実行文字列を対象とし、保存ファイル末尾のLFを1個除いた内容に一致します。対象生成物や契約ファイルのハッシュとは区別してください。

## 確認

node scripts/build-runtime.mjsで再生成し、pnpm checkで生成物の一致・整形・静的検査・型検査・契約を確認します。scripts/build-host-*.mjsはtmp/へ検証出力を作ります。配置変更だけで、過去の実機結果を新しい生成物の検証済み証跡として扱わないでください。

## 依存更新とセキュリティ監査

Dependabot は npm と GitHub Actions の更新PRを毎週月曜10:20 JSTに作成します。npm の更新は公開後7日待ち、実行時依存と開発用依存それぞれのマイナー・パッチ更新をまとめます。メジャー更新は個別PRで確認します。

CIでは依存導入前に `pnpm audit --audit-level=high` を実行します。開発用依存を含むロックファイル全体を監査し、重大度 high / critical の検出と監査サービスへの接続失敗を検査失敗にします。自動修正や検出結果の無視は行いません。

`dependency-audit.yml` は毎日09:37 JSTと手動実行で同じ監査を行います。GitHubホストの Ubuntu ランナーで依存パッケージのインストールやビルドをせずに検査します。結果は Actions の実行履歴で確認します。pnpm の固定版を更新するときは、このワークフローの版指定も合わせて更新してください。
