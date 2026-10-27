# npmへの公開手順

[English](npm-publication.md) | 日本語（正本）

初期版0.1.0は、式の優先順位補正とRollup 4への組み込みを提供し、2026年10月26日にnpmへ一般公開した。当初はGitHubリポジトリを非公開とし、npmの配布物にはsrcのJavaScript、型定義、README、MITライセンスを含めた。

2026年10月27日に、履歴・PR・Actionsログを確認してGitHubリポジトリも公開した。以後はMITライセンスの公開リポジトリとして運用し、利用者が実装・試験・変更理由を確認し、不具合報告や修正提案を行えるようにする。GitHubの公開範囲とnpmへの版の登録は別の操作として扱う。

## GitHubリポジトリの公開前確認

公開へ切り替える前に、現在のファイルだけでなく、リモートブランチ・タグ・PRから到達できる過去のコミット、PR本文・コメント・レビュー、Actionsの全試行ログ・検査注釈・保存成果物を確認する。公開すると過去のコードやActionsの実行履歴とログも閲覧可能になるため、認証情報、個人用パス、顧客データなどを含む場合は公開を止めて対処する。

2026年10月27日、基点コミットfa198c95fa7b3542100bf2cdc3d49b235c1bd6e4に対して、次を確認した。

| 対象    | 確認範囲                                                                                                  |
| ------- | --------------------------------------------------------------------------------------------------------- |
| Git履歴 | 全リモートブランチ・タグとPR #1〜#4の参照から取得した14コミット、88種類のファイル内容、著者・コミット情報 |
| PR      | #1〜#4の本文・差分・コミット情報。通常コメント・行コメント・レビュー投稿はいずれも0件                     |
| Actions | 13実行の全13試行、52ジョブ、148ログファイルと41件の検査注釈                                               |
| その他  | Issue・リリース・保存成果物はいずれも0件。公開への変更で無効になるプッシュルールセットも0件               |

Gitleaks 8.30.1の既定規則で、全履歴（--all --full-history）、PRなどの公開対象データ、展開した全ログを検査し、認証情報の検出は0件だった。著者情報、絶対パス、外部参照と実機証跡も文脈を確認した。著者メールは公開用のnoreplyアドレス、ログの絶対パスはGitHub管理の実行環境のものだった。関連する利用側への参照には、そのソースや設定を含めていない。公開を妨げる認証情報・個人用パス・顧客データは見つからなかった。

この件数は方針更新前の記録である。方針更新のPRと増分を含め、公開直前に15コミット、PR 5件、Actions 14実行・56ジョブ・200ログファイルを確認した。公開後は認証なしのGitHub APIでvisibilityがpublic、privateがfalseとなり、READMEとPRを取得できることを確認した。統合後の追加検査を含む最終結果はPR #5に記録している。取得した生ログや認証済みAPI固有の一時的な認証データは、文書や配布物へ転記しない。

## 初回npm公開の記録と手順

2026年10月26日の初回公開前確認では、extendscript-compatへのnpm照会は404だった。当時は名前が予約されていなかったため、公開直前に再確認する方針とした。取得済みになっていた場合は登録を止め、所有するnpmアカウントのスコープ配下への変更を検討していた。名前を変更する場合は、利用側の依存指定と使用例も同時に更新する。

### 初回公開までの順序

1. ライブラリと利用側の検証・独立レビューを完了し、公開するコミットを固定する。
2. GitHubリポジトリが公開方針に沿って公開されていること、npmの所有者、パッケージ名、MITライセンスを確認する。npmの一般公開パッケージにはsrcのJavaScriptと型定義も含まれる。出所証明を付ける場合は、公開リポジトリと対応するCIから登録する。
3. 公開準備のPRでprivateを削除し、publishConfig.accessをpublic、publishConfig.registryをhttps://registry.npmjs.org/にする。内容を確認したうえで統合し、そのコミットから再検証・再梱包する。開発段階で作ったprivate付きのtarballは公開に流用しない。
4. 初回は所有者がnpmへログインし、二要素認証を使って確認済みのtarballを登録する。登録後、別の空ディレクトリから導入し、本体とRollup用の入口を再確認する。
5. adobe-cepの同梱tarballをnpm依存へ置き換え、公開テンプレート側の導入PRを提出する。その後、Bolt-CEPへの統合を提案する。

初回登録は、二要素認証を有効にした所有者の端末で行う。実行するのは公開が承認され、固定コミットから梱包し直した後とする。

接続・登録情報・梱包内容の確認はpnpm 12.15.0で実行できる。初回公開では、このライブラリのディレクトリでnpm CLIへログインし、同じCLIから確認済みのtarballを登録する。ログイン後はnpm whoamiとpnpm whoamiの両方で所有者を照合する。

```sh
npm login
npm whoami
pnpm whoami
pnpm ping
npm profile get tfa --json
pnpm view extendscript-compat name version
pnpm install --frozen-lockfile
pnpm check
pnpm pack --pack-destination artifacts
npm publish ./artifacts/extendscript-compat-0.1.0.tgz --access public --registry=https://registry.npmjs.org/
pnpm view extendscript-compat@0.1.0 version dist.integrity
```

公開直前に固定コミット、梱包物のSHA-256、privateが含まれないこと、配布対象7ファイルを照合する。公開後はレジストリのdist.integrityと取得したtarballを照合し、空の利用側へ導入して公開APIとRollup連携を確認する。登録が受理された後の通信切断では、同じ版を再公開せず、先にレジストリ上の状態を確認する。

名前の照会で404になることは、公開時の名前の取得を保証しない。梱包物の一覧はpnpm pack --dry-run --jsonで事前確認する。初回公開時のfilesはsrc、README.md、LICENSEに限定したが、package.jsonなどnpmが自動的に含めるファイルも確認した。npm登録自体には料金のかからない公開パッケージを想定する。

## 継続的な公開方法

初回登録後は、GitHub ActionsとnpmのTrusted Publisherを使う方法を推奨する。公開用の専用ワークフローを将来追加し、そのファイル名とGitHubの所有者・リポジトリをnpm側へ正確に登録する。直接npm publishする場合は、Trusted Publisherの設定でその操作を明示的に許可する。OIDCを利用するため、公開用の長期トークンをリポジトリへ保存する必要がない。

公開用ワークフローはGitHub管理の実行環境、Node.js 24、対応するnpm CLIを使い、contents: readとid-token: writeを設定する。指定コミットの検証と梱包を通してからnpm publishを実行する。現在のCIには公開処理とid-token権限を含めない。

Trusted Publisherにはnpm CLI 11.5.1以降とNode.js 22.14.0以降が必要。設定後の初回公開は2日以内に成功する必要があるため、公開準備が整ってから設定する。公開リポジトリから公開パッケージを登録する場合、出所証明は自動生成される。非公開リポジトリでは出所証明が生成されない。

## 出荷条件

評価結果、短絡評価、副作用の順序、既存括弧、繰り返し適用、最小化後の出力、ソースマップ、梱包後の導入を検証する。After Effectsでの確認条件を明記し、IllustratorやPhotoshopなど未検証の製品を対応確認済みと表記しない。

最初の版は検証した用途へ適用範囲を限定する。補正内容の修正はpatch、後方互換のある補正追加はminor、入力条件や公開インターフェースの変更は次のminorとして扱い、0.xでは変更点を明記する。既存の版へ上書き公開しない。

## 参照

- [GitHubリポジトリの公開範囲と変更の影響](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)
- [公開パッケージの作成と登録](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/)
- [Trusted Publisherの設定と制約](https://docs.npmjs.com/trusted-publishers/)
- [出所証明の生成](https://docs.npmjs.com/generating-provenance-statements/)

- [pnpmによる梱包内容の事前確認](https://pnpm.io/cli/pack)
- [pnpmによる認証設定の確認](https://pnpm.io/cli/profile)

## 公開前後の確認

公開するコミットを固定した後、`pnpm check`、実機検証用の生成物のハッシュ照合、`pnpm pack`、空の利用側への導入を確認する。配布物には公開入口と型宣言、日英の利用文書、第三者ライセンスを含め、梱包時の一覧と`package.json`を照合する。

公開後は、通常入口・Rollup入口・runtime入口・unit-value入口のすべてを取得したパッケージから読み込む。runtimeは明示的に読み込むまで共有関数を置換せず、unit-valueの入口は読み込みだけではホストのクラスや関数を変更しない。
