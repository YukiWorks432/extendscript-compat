# 0.2.0追加互換補正の実機確認

2026年10月26日、WindowsのAfter Effects 26.5x89 / ExtendScript 4.5.6（build 80.1060872）で、EC-03・06・10・11の補正方法を調査し、実装の最終出力を確認した。

## 調査と採用した方法

[調査コード](evidence/compatibility-investigation.jsx)と[結果](evidence/compatibility-investigation-ae-26.5.json)に、入力と実行本文のSHA-256を記録している。

| 対象  | 実機で観測した差                                                                                                                                                              | 採用した方法                                                                                                                        |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| EC-03 | switch内の無名continueは後続へ到達した。対象ループのラベルを指定すると正しく次の反復へ進んだ。ラベル付きcontinueの末尾のセミコロンを省くと、Expected: ;の構文エラーになった。 | 無名continueを診断し、ラベル指定の回避策を案内する。圧縮後に省略されたラベル付きcontinueのセミコロンを補う。                        |
| EC-06 | 文字クラス内の16進表記のハイフンが範囲になった。明示的なエスケープでは正常だった。                                                                                            | ES3のg・i・mフラグのリテラルを局所変換する。文字クラス外、文字列、動的なコンストラクタは変えない。                                  |
| EC-10 | 数値10−2 inが-8 inになった。演算子を直接上書きできる例もあったが、元の演算子を取得した後では上書きが効かなかった。プロトタイプの変更でも新規インスタンスは直らなかった。      | subtractUnitValuesで数値−UnitValueだけを明示的に補正し、純正の型・単位・baseUnitを保つ。ほかの数値・UnitValueの減算は純正へ委ねる。 |
| EC-11 | 0.5 inのUnitValueとnullの厳密比較がtrueになった。先にUnitValueを区別すると正常だった。                                                                                        | isNullを明示的に使う。クラスや既存の演算子は変更しない。                                                                            |

これらの結果から、型の分からない減算や比較を一律に書き換える方式、共有のUnitValueコンストラクタを差し替える方式は採用しない。通常の演算子が自動で修正されたという保証も行わない。

## 最終出力の検証

実装ファイルと共用の検証資料から、Rollupで非圧縮版とTerser圧縮版を作成し、それぞれの生成後にextendscriptCompatを適用した。各版は元の4関数へ戻してから独立に適用し、同じ版の再読込も確認した。

| 出力           | 初回                 | 再読込               |
| -------------- | -------------------- | -------------------- |
| 非圧縮・補正後 | 追加36/36、既存71/71 | 追加36/36、既存71/71 |
| 圧縮・補正後   | 追加36/36、既存71/71 | 追加36/36、既存71/71 |

追加の確認には、ラベル付きcontinueのfinally、文字クラスの否定・範囲端点・エスケープ、減算方向、型、単位、px・%の換算基準、符号付きゼロ、入力不変、不正入力、nullとUnitValueの区別を含む。Nodeではホスト固有の演算子を模擬して保証したことにはせず、AEで別に実行する。

4関数の新規適用と再適用時の同一性、終了時の復元、UnitValueコンストラクタとプロジェクト状態の保持も確認する。結果と生成物のハッシュは[実機証跡](evidence/compatibility-ae-26.5.json)に保存する。プロジェクトの追加・変更・保存は行わない。

## 再実行

```sh
pnpm check
node scripts/build-host-compatibility-probe.mjs
```

生成先はtmp/compatibility-host-probeである。manifest.jsonは2種類の実出力、probe.jsx、eval.runへ渡すprobe-body.jsxのSHA-256を記録する。probe-body.jsxをAE接続のeval.runへ渡すと、検証後に元の関数と共有エンジン用の印をfinallyで復元する。戻り値の失敗一覧、適用・復元、生成物のハッシュを証跡と照合する。

調査中、標準MCP経路で結果待ちの時間切れが発生したため、その要求は取消しを要求し、応答する別のAE接続のeval.runで調査と最終検証を行った。時間切れをホスト試験の成功には数えていない。接続設定やプロジェクトは変更していない。

確認範囲は上記のAE環境である。他のAdobe製品・旧版、E4X、JSXBin化後の実機実行、既存の利用側プロジェクトへの組み込みは未確認である。正規表現エンジンのキャプチャ消失や停止は今回の補正範囲に含めない。

## 根拠資料

- [ExtendScriptの演算子上書き](https://extendscript.docsforadobe.dev/extendscript-tools-features/operator-overloading/)
- [UnitValueの演算と換算基準](https://extendscript.docsforadobe.dev/extendscript-tools-features/specifying-measurement-values/)
- [IdExtensoのUnitValue調査](https://github.com/indiscripts/IdExtenso/blob/0c2f70f4afa25aff691ebdc72575103965a66aee/etc/%24%24.Unit.jsxlib#L166)
- [EC-03の当事者報告](https://community.adobe.com/questions-628/bug-extendscript-incorrectly-handles-the-continue-statement-within-switch-statements-685465)
