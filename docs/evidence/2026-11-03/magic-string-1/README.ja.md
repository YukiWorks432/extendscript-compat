# magic-string 1系への移行検証

2026-11-03、Issue #37 の `0.30.21` → `1.4.5` を Windows / Node.js 24.22.1 / pnpm 12.16.1 で比較した記録です。開始コミットは `d62a1504cfd3e7ba8a95a2a0a6ecbcae2e05a83b` です。

## 比較結果

既存テストが数値変換を行う16種類の入力と、今回追加したLF・CRLFの2種類の入力について、生成コードとソースマップが一致しました。圧縮・ソースマップ出力形式などを変えて同じ入力を処理する場合は重複を除いています。入力、設定、両版で一致した出力のSHA-256は [comparison.json](comparison.json) に保存しています。

比較は `src/number-transform.js` の出力を対象とします。ソースマップの `options.source` と `sources` にある実行場所の絶対パスだけを相対パスへ正規化し、`mappings`、`sourcesContent`、`names`、生成コードは変更していません。旧版で全239テスト、新版で追加分を含む全245テストが成功しました。追加分を含む数値変換の35テストは旧版でも成功しています。

記録時は一時的なVitestの `setupFiles` から `magic-string` の既定エクスポートを継承し、`generateMap` の親メソッドを実行した後に入力・設定・生成コード・ソースマップを保存しました。この記録用の差し替えを使わない通常の `pnpm check` でも検証します。最終的なRollup出力の実行結果、ES3構文、元位置への対応は既存テストと今回の追加テストで確認します。

保存した入力を現在導入されている版で再検証する場合は、リポジトリのルートから次を実行します。

```sh
node docs/evidence/2026-11-03/magic-string-1/verify.mjs
```

この検証は記録時の入力と出力を対象とし、将来の仕様変更を拘束する通常のテストには組み込んでいません。旧版との再比較は、別の一時チェックアウトで `pnpm add --save-exact magic-string@0.30.21` を実行してから、同じ検証を実行できます。

## 移行判断

[1.0.0の変更内容](https://github.com/Rich-Harris/magic-string/releases/tag/v1.0.0)では、ESM専用化に伴いCommonJS・UMD・IIFE形式の配布が終了しています。このリポジトリは既に `type: module` とESMの `import` を使用しているため、読み込み方の変更は不要です。Adobeへ渡すコードは引き続きES3として検査します。

[1.4.5の変更内容](https://github.com/Rich-Harris/magic-string/releases/tag/v1.4.5)には、編集位置の範囲検査、分割した編集範囲の名前保持、ソースマップ処理の改善などが含まれます。比較対象では出力差がなく、変換処理の修正は不要でした。性能測定は行っていません。

`magic-string` はビルド時に外部依存として読み込み、コードをこのパッケージへ複製していません。旧版・新版ともMITライセンスで、依存パッケージの著作権表示は `Copyright 2018 Rich Harris` のままです。このため、取り込んだ第三者コードを記載する `THIRD-PARTY-LICENSES.txt` の変更は不要です。

公開API、配布するランタイム、パッケージの版番号は変更しません。Adobe実機での再検証は行っていません。Windows / Linux、Node.js 22 / 24の通常検査とパッケージ生成の結果は、対象コミットのPRとCIの記録を参照してください。
