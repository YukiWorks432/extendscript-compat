# npmへの登録計画

初期版は0.1.0とし、式の優先順位補正とRollup 4への組み込みを提供する。現時点ではGitHubリポジトリを非公開に保ち、npmへは公開しない。package.jsonのprivateも有効のままにする。

2026年10月25日の確認では、extendscript-compatへのnpm照会は404だった。名前は予約できていないため、実際の公開直前に再確認する。取得済みになっていた場合は、所有するnpmアカウントのスコープ配下の名前へ切り替え、利用側の依存指定と使用例を同時に更新する。

## 公開までの順序

1. ライブラリと利用側の検証・独立レビューを完了し、公開するコミットを固定する。
2. GitHubリポジトリの公開範囲、npmの所有者、パッケージ名、MITライセンスを確認する。npmの一般公開パッケージにはsrcのJavaScriptと型定義も含まれる。GitHubを非公開のままにすることは可能だが、出所証明を付ける運用には公開リポジトリが必要になる。
3. 公開準備のPRでprivateを削除し、publishConfig.accessをpublicにする。内容を確認したうえで統合し、そのコミットから再検証・再梱包する。開発段階で作ったprivate付きのtarballは公開に流用しない。
4. 初回は所有者がnpmへログインし、二要素認証を使って確認済みのtarballを登録する。登録後、別の空ディレクトリから導入し、本体とRollup用の入口を再確認する。
5. adobe-cepの同梱tarballをnpm依存へ置き換え、公開テンプレート側の導入PRを提出する。その後、Bolt-CEPへの統合を提案する。

初回登録は、二要素認証を有効にした所有者の端末で行う。実行するのは公開が承認され、固定コミットから梱包し直した後とする。

```sh
npm login
npm whoami
npm view extendscript-compat name version
pnpm install --frozen-lockfile
pnpm check
pnpm pack --pack-destination artifacts
npm publish ./artifacts/extendscript-compat-0.1.0.tgz --access public
npm view extendscript-compat@0.1.0 version dist.integrity
```

名前の照会で404になることは、公開時の名前の取得を保証しない。梱包物の一覧はnpm pack --dry-run --jsonで事前確認する。filesはsrc、README.md、LICENSEへ限定しているが、package.jsonなどnpmが自動的に含めるファイルも確認する。npm登録自体には料金のかからない公開パッケージを想定する。

## 継続的な公開方法

初回登録後は、GitHub ActionsとnpmのTrusted Publisherを使う方法を推奨する。公開用の専用ワークフローを将来追加し、そのファイル名とGitHubの所有者・リポジトリをnpm側へ正確に登録する。OIDCを利用するため、公開用の長期トークンをリポジトリへ保存する必要がない。

公開用ワークフローはGitHub管理の実行環境、Node.js 24、対応するnpm CLIを使い、contents: readとid-token: writeを設定する。指定コミットの検証と梱包を通してからnpm publishを実行する。現在のCIには公開処理とid-token権限を含めない。

Trusted Publisherにはnpm CLI 11.5.1以降とNode.js 22.14.0以降が必要。設定後の初回公開は2日以内に成功する必要があるため、公開準備が整ってから設定する。公開リポジトリから公開パッケージを登録する場合、出所証明は自動生成される。非公開リポジトリでは出所証明が生成されない。

## 出荷条件

評価結果、短絡評価、副作用の順序、既存括弧、繰り返し適用、最小化後の出力、ソースマップ、梱包後の導入を検証する。After Effectsでの確認条件を明記し、IllustratorやPhotoshopなど未検証の製品を対応確認済みと表記しない。

最初の版は検証した用途へ適用範囲を限定する。補正内容の修正はpatch、後方互換のある補正追加はminor、入力条件や公開インターフェースの変更は次のminorとして扱い、0.xでは変更点を明記する。既存の版へ上書き公開しない。

## 参照

- [公開パッケージの作成と登録](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/)
- [Trusted Publisherの設定と制約](https://docs.npmjs.com/trusted-publishers/)
- [出所証明の生成](https://docs.npmjs.com/generating-provenance-statements/)
