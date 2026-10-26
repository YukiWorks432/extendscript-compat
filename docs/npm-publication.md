# npmへの公開手順

初期版は0.1.0とし、式の優先順位補正とRollup 4への組み込みをnpmの一般公開パッケージとして提供する。2026年10月26日に公開の許可を得た。GitHubリポジトリの公開範囲は非公開のままとし、npmの配布物にはsrcのJavaScript、型定義、README、MITライセンスを含める。

2026年10月26日の公開前確認では、extendscript-compatへのnpm照会は404だった。名前は予約できていないため、実際の公開直前に再確認する。取得済みになっていた場合は登録を止め、所有するnpmアカウントのスコープ配下への変更を確認する。名前を変更する場合は、利用側の依存指定と使用例も同時に更新する。

## 公開までの順序

1. ライブラリと利用側の検証・独立レビューを完了し、公開するコミットを固定する。
2. GitHubリポジトリの公開範囲、npmの所有者、パッケージ名、MITライセンスを確認する。npmの一般公開パッケージにはsrcのJavaScriptと型定義も含まれる。GitHubを非公開のままにすることは可能だが、出所証明を付ける運用には公開リポジトリが必要になる。
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

名前の照会で404になることは、公開時の名前の取得を保証しない。梱包物の一覧はpnpm pack --dry-run --jsonで事前確認する。filesはsrc、README.md、LICENSEへ限定しているが、package.jsonなどnpmが自動的に含めるファイルも確認する。npm登録自体には料金のかからない公開パッケージを想定する。

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

- [pnpmによる梱包内容の事前確認](https://pnpm.io/cli/pack)
- [pnpmによる認証設定の確認](https://pnpm.io/cli/profile)

## 0.2.0の公開準備

0.2.0にはEC-04・05・07・08の実行時補正に加え、EC-03の自動ラベル挿入・通知とセミコロン補完、EC-06の正規表現リテラル補正、EC-10・11の明示的なUnitValue補助APIを含める。今回は版番号・文書・実装を準備するPRであり、npm公開、タグ作成、GitHubリリースは行わない。

公開するコミットを固定した後、pnpm check、実機検証用の生成物のハッシュ照合、pnpm pack、空の利用側への導入を再確認する。配布物にはruntime/index.jsと型宣言、runtime/unit-value.jsと型宣言、実行時の利用文書、第三者ライセンスを含める。初期版の7ファイルという記載を0.2.0へ流用せず、梱包時の一覧を正本として確認する。

公開後の確認では、通常入口・Rollup入口・runtime入口・unit-value入口のすべてを取得したパッケージから読み込む。runtimeは明示的に読み込むまで共有関数を置換せず、unit-valueの入口は読込だけではホストのクラスや関数を変更しない。
