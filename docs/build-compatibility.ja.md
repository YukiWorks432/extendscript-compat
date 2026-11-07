# ビルド時の互換補正

[English](build-compatibility.md) | 日本語（正本）

## 使用例

Node.js 22以降が必要です。解析にはBabelを使います。`protectPrecedence`はコード全体を再生成せず、元の文字列へ括弧を挿入します。

```js
import { protectPrecedence, assertPrecedenceProtected } from "extendscript-compat";

const result = protectPrecedence("var value = a || b && c; var other = a ? b : c ? d : e;");
// var value = a || (b && c); var other = a ? b : (c ? d : e);
assertPrecedenceProtected(result.code);
```

`protectPrecedence`は、補正後の`code`と、元の文字列に対する括弧の挿入位置`insertions`を返します。同じコードへ繰り返し適用しても、括弧が増え続けることはありません。

`findPrecedenceIssues`は、保護されていない箇所の種類、文字位置、行、列を返します。行は1始まり、列と文字位置は0始まりです。公開する診断情報にはBabelのAST型を含めません。

## ES3構文の検査

Rollupの`extendscriptCompat()`は、各出力チャンクの互換補正後にES3構文を自動検査します。不適合なら位置を含むエラーでビルドを停止します。`diagnostics: "off"`でも検査は有効です。利用側でAcornを直接導入したり、検査関数を呼び出したりする必要はありません。

内部ではAcornに`ecmaVersion: 3`、`sourceType: "script"`、`allowReserved: "never"`を指定します。ES3指定だけでは予約語を許可するAcornの既定動作も制限し、`value.default`や`{ default: 1 }`を拒否します。`value["default"]`と`{ "default": 1 }`は使用できます。

ES3構文への変換は、プラグインより前のビルド処理で済ませてください。先頭のBOMとコメントは受け入れますが、ES2015以降の構文、TypeScript、ESモジュール構文、E4X、未展開のプリプロセッサー指示、関数外の`return`は受け入れません。実行時APIの有無やAdobe製品での動作は、構文検査だけでは保証できません。

`protectCompatibility()`などの補正APIを直接使う場合、その呼び出しにはES3構文検査を含みません。

Terserを使う場合は、最上位の`ie8: true`を指定してください。既定設定では`object["for"]`などを`object.for`へ圧縮することがあり、ES3構文検査でビルドが停止します。

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

各出力チャンクへ補正と検査を行い、既存の有効なソースマップを括弧・セミコロンの挿入と正規表現の置換に合わせて更新します。外部ファイル、inline、hiddenの形式に対応します。 inlineのURLは実際の行コメントだけを更新し、先行するinclude展開で追加された文字列やブロックコメント内の`sourceMappingURL`は保持します。先行プラグインがコードを変更したのにソースマップを更新していない場合、その情報の復元はできません。CEP固有のinclude処理への対応は利用側の組み込み処理で行ってください。

## ponyfillモード

Rollupの`extendscriptCompat()`は、設定を省略した場合も、最終出力にあるグローバルの`Object.freeze(...)`を補正します。Rollupが`import * as library`の名前空間に追加する呼び出しや、先行するinclude処理の直接呼び出しも対象です。既存の`freeze`関数があれば使い、関数がない場合は最初の引数をそのまま返します。ホストへ関数は追加せず、プロパティの凍結も行いません。`Object.freeze || customFreeze`のような単なる参照は、この最終出力の補正では変更しません。動的なメソッド名や`Object`自体の別名は対象外です。

この補正はRollupプラグインの機能です。`protectCompatibility()`単体には含まれません。`output.freeze: false`を強制せず、凍結できるホストの動作を維持します。

`runtime: "ponyfill"`を指定すると、ES5を含む標準APIへの参照をバンドル内の補完処理へ変換します。利用側は従来どおりのメソッド呼び出しを書けます。

```js
// Rollupの設定
extendscriptCompat({ runtime: "ponyfill" });

// 利用側のコード。補助APIの読み込みは不要です。
var names = items.filter(isEnabled).map(getName);
var keys = Object.keys(data);
var handler = callback.bind(context);
var text = JSON.stringify(data);
```

設定は省略または`"ponyfill"`です。省略時は従来どおり、明示的な`extendscript-compat/runtime`の読み込みがホストへ補完・補正を適用します。ponyfillモードでは同じ読み込みを空のモジュールとして扱うため、利用側のコードを変えずにRollupの設定だけで切り替えられます。

対象はArrayのES5走査・検索・集約、Functionの`bind`、`Array.isArray`、`Object.keys`、Date・Number・StringのES5補正、JSON、および[実行時API対応表](../runtime/API-COMPATIBILITY.ja.md)のES2015・後年のメソッドです。`Object.defineProperty`・`setPrototypeOf`とReflectの属性・プロトタイプ操作は、ホストが提供する基礎機能の範囲で利用できます。未対応のPromise・Symbolなどを追加するモードではありません。

次の参照も変換します。ローカル変数や引数が組み込み名を隠している場合は、その束縛を保持します。インスタンス自身や独自のプロトタイプに定義されたメソッドも保持し、対象とメソッドの取得、引数の評価順序、`this`を維持します。

```js
Array.prototype.map.call(arrayLike, callback);
var map = Array.prototype.map;
var keys = Object.keys;
items["map"](callback);
```

補完コードはバンドル内に保持し、グローバル、組み込みコンストラクターやプロトタイプ、導入済み印を書き換えません。JSONの日付出力も内部で扱い、`Date.prototype.toJSON`などを追加しません。入力を変更する`fill`や`Reflect.set`などの操作は、その仕様どおり入力を変更します。利用側や他ライブラリが明示的に行うホストの変更を防ぐ隔離機能はありません。

Numberの呼び出し変換はモジュール処理に残し、ponyfillは圧縮後のrenderChunkで適用します。入力と依存モジュールに加え、Rollupが生成する名前空間・再公開の処理も対象です。補完本体は変換後に挿入し、複数チャンクではRollupの依存関係を通じて共有します。互換補正・BOM・ES3検査とソースマップは引き続き有効です。TypeScriptでは既存の`/runtime`の型宣言や標準の`lib`設定を使用できます。

実行時に決まる`object[methodName]`、組み込みオブジェクト自体の別名（`var O = Object; O.keys(...)`など）、分割代入、`eval`・Functionコンストラクター内の文字列、外部JSX、モジュール変換後にinclude処理などで追加するコードは変換しません。`new Date(...)`や暗黙の型変換、プロトタイプの列挙や`in`演算子による機能判定もホストの挙動を維持します。別エンジン由来の値やホスト固有オブジェクトは利用環境ごとに確認してください。

## 対応範囲

上記のモジュール変換の対象外となるコードでも、最終出力に含まれる`Object.freeze(...)`の直接呼び出しは、前述の最終出力の補正で扱います。ほかのAPIをこの段階で自動補完する機能はありません。

protectPrecedenceは従来どおり括弧だけを挿入します。protectCompatibilityとRollup用のextendscriptCompatは、下記のEC-03・EC-06・EC-20とUnicode文字も扱います。

入力は通常のJavaScriptとして生成されたコードです。TypeScriptの変換やES3構文への変換は、Babelなど既存のビルド処理へ委ねます。ExtendScript固有のE4Xや未展開のプリプロセッサー指示を含む生のJSXファイルは対象にしません。構文解析に失敗した場合は例外を返し、無変換のまま成功扱いにはしません。

混在する&&と||の境界、および三項演算子の条件部・真側・偽側に直接入れ子になった三項演算子を括弧で保護します。値、短絡評価、this、arguments、evalから見える束縛を保ち、関数や一時変数を追加しません。JSON実装、ファイルの文字コード、Adobe製品APIなどの検査は利用側で行ってください。

After Effects 26.5x89 / ExtendScript 4.5.6で言語回帰22件と利用側の製品回帰96件を確認しています。IllustratorやPhotoshopなど、ほかの製品での実機確認は行っていません。

## for初期化部分のin演算子（EC-20）

After Effects 26.5x89 / ExtendScript 4.5.6では、`for`の初期化部分に`in`演算子があると、括弧内や関数本体に書かれた場合も構文エラーになります。これは標準ES3として有効な書き方でも発生するため、ES3構文検査だけでは検出できません。Terserによって配列複製用の関数が初期化部分へ移された生成物でも発生します。

`protectCompatibility()`とRollupの`extendscriptCompat()`は、該当する初期化部分を同じスコープの直前の文へ変え、ブロックで囲みます。`var`宣言と式の初期化を扱い、ラベル付きの`break`・`continue`、評価順序、実行回数、`this`・`arguments`・直接の`eval`の束縛を保ちます。関数や一時変数は追加せず、`in`演算子の意味も変えません。変換前のES3外の`let`・`const`宣言をこの方法で移すことはできないため、該当入力は例外にします。

```js
// 補正前
for (var present = ("key" in object); present; present = false) use(object);
// 補正後
{
  var present = "key" in object;
  for (; present; present = false) use(object);
}
```

`findCompatibilityIssues()`は元の初期化部分を`code: "EC-20"`、`kind: "for-initializer-in"`として返します。自動補正したEC-20は、既存のEC-06と同様に`protectCompatibility().diagnostics`へ通知しません。補正は`diagnostics`設定にかかわらず実行し、Rollupでは補正後に対象の構造が残っていればビルドを停止します。補正後のコードを再圧縮しないでください。

## Number呼び出しの自動補正

Rollupの`extendscriptCompat()`は、モジュール内でグローバルの`Number`を直接呼び出す箇所を、`extendscript-compat/number`の`toNumber`へ標準で変換します。直接の`new Number(...)`は、引数の数値変換を補正してから元の`Number`でオブジェクトを作ります。利用側での読み込みは不要で、ホストの`Number`は置き換えません。

```js
// 利用側コード。AEでもvalueは5、boxedは値5のNumberオブジェクトになる。
const value = Number("0b101");
const boxed = new Number("0b101");
const convert = Number;
const another = convert("0b101");
```

別名は`Number`を直接代入し、参照が宣言のあるブロック内での宣言後・同じ関数からの直接呼び出しと、`Number`との`===`・`!==`による同一性比較に限られる場合に変換します。同一性比較は保持します。別関数内の参照、条件付きの宣言、初期化前の呼び出し、別名を使った`new`など、安全に判定できない場合は変換せず、既定で警告します。直接の`eval`がモジュールにある場合も、別名は変換しません。

ローカルで定義した別の`Number`やオブジェクトのメソッドは変換しません。`Number.call`・`apply`・`bind`などの間接参照は変換せず、既定で警告します。`Number.parseInt`などの静的プロパティは変更しません。`$.global.Number`、文字列からの`eval`、外部スクリプト内の呼び出しは対象外です。必要な場合は明示的に`toNumber`を使ってください。

自動変換はRollupのモジュール処理中に行います。TypeScriptなどの変換後、バンドル・圧縮前に適用し、include展開でその後追加されたコードは対象になりません。先行する処理が失ったソースマップは復元できません。既存の`protectCompatibility(source)`単体ではNumberを自動変換しません。

## UTF-8 BOMの付与

Rollupの`extendscriptCompat()`は、生成した各JavaScriptチャンクの先頭へ既定でUTF-8 BOMを付けます。すでに先頭にBOMがある場合は重複させません。BOMは、先頭にASCIIが続くUTF-8ファイルをAfter Effectsの`$.evalFile`が別の文字コードとして読み込む問題を避けるためのものです。

```js
// BOMを付けない場合
extendscriptCompat({ bom: false });
```

無効にした出力にBOMがなく非ASCII文字が残る場合は、`MISSING_BOM`として警告します。ASCIIだけの出力や、先頭にすでにBOMがある出力には警告しません。この警告は`diagnostics`の設定にかかわらず通知します。

BOMはUTF-8のファイル先頭に付く目印です。後続の処理がBOMを除去したり別の位置へ移動したりしないよう、最終出力を確認してください。`protectCompatibility`と`protectUnicode`は先頭のBOMを保持しますが、単独ではBOMを追加しません。文字列や正規表現内のU+FEFFは引き続きエスケープします。 [After Effects 2025・2026での検証結果](https://github.com/YukiWorks432/extendscript-compat/blob/c313a4c5305f947bfcf996d5ff743858aa4c6487/docs/evidence/bom-ae-2025-2026.json)では、2025のBOMなし出力のみ`$.evalFile`で読み込みエラーになりました。

## Unicode文字の補正

After Effects 26.5の`$.evalFile`では、コード中に直接書かれたU+200C・U+200D・U+FEFFが失われることがあります。`protectCompatibility`とRollup用の`extendscriptCompat`は、文字列と正規表現の該当文字を標準で`\u`表記へ変換します。

```js
extendscriptCompat();
```

圧縮とinclude展開が済んだ後に実行してください。後続の処理が再び生の文字を出力すると補正が失われます。文字列はUTF-16の値、正規表現は一致結果を保ちます。正規表現の`source`や`toString()`には変換後の表記が現れます。U+200Bや絵文字など、上記以外の文字はこの処理では変換しません。

上記の文字が識別子、コメント、ライセンス表示、文字列と正規表現以外の場所にある場合は、安全な変換を保証できないためエラーにします。識別子の`\u200c`・`\u200d`も対象です。エラーの行は1始まり、列はUTF-16のコード単位で0始まりです。未展開のディレクティブやE4Xを含む入力には対応しません。

Rollupを使わない場合は`protectUnicode(source)`を使うか、`protectCompatibility(source)`で他の補正と同時に適用できます。どちらも変換後の`code`と元の入力に対する`edits`を返します。After Effects 26.5x89での検証条件と結果は[実機検証結果](https://github.com/YukiWorks432/extendscript-compat/blob/c313a4c5305f947bfcf996d5ff743858aa4c6487/docs/evidence/unicode-output-ae-26.5.json)を参照してください。

## EC-03・EC-06のビルド時補正と診断

Rollup用の`extendscriptCompat()`は、優先順位の保護に加え、次の補正を行います。

- EC-03: switchをまたいで外側のループへ進む、ラベルのないcontinueを自動補正します。対象ループの既存ラベルを再利用し、ラベルがなければ衝突しない名前で追加します。同じループを対象とする場合は、一つのラベルを共有します。内側のループを対象とするcontinueは変えません。圧縮後に省かれたラベル付きcontinueの末尾のセミコロンも補います。
- EC-06: g・i・mのみを使う正規表現リテラルの文字クラス内で、`\x2D`・`\u002D`を`\-`へ置き換えます。小文字の16進数字にも対応します。動的なRegExpコンストラクタの文字列や、文字クラス外のエスケープは変更しません。

EC-03は既定で自動補正し、補正した箇所を警告として通知します。自動補正できないNumberの間接参照も警告します。元のコードにEC-03を含めない方針をCIで徹底する場合は、補正可能な場合もビルドを停止する`error`を選べます。通知せずに自動補正する場合は`off`を選びます。

```js
extendscriptCompat({ diagnostics: "error" });
// "warn": 警告（既定値）、"error": ビルド停止、"off": EC-03とNumberの通知を省略
```

ビルドツールへ直接組み込む場合は、統合APIを使います。

```js
import { findCompatibilityIssues, protectCompatibility } from "extendscript-compat";

const result = protectCompatibility(source);
// result.code: 優先順位・EC-06・continueのラベル・セミコロン・Unicodeを補正したコード
// result.edits: 元の入力に対する挿入と置換（start / end / text）
// result.diagnostics: 自動補正したEC-03の通知（元の入力上の位置）
const issues = findCompatibilityIssues(source);
```

`findCompatibilityIssues`は、補正前のEC-03・EC-06・EC-20を返します。`protectCompatibility`の`diagnostics`は元のコードにあったEC-03の通知であり、補正後に未解決の不具合が残っていることを示すものではありません。各診断は`code`、`kind`、`start`、`end`、`line`、`column`、`message`を持ちます。行は1始まり、列と文字位置はUTF-16のコード単位で0始まりです。統合APIの`edits`と診断の位置はいずれも元の入力を指します。正規表現の`source`や`toString()`には補正後の表記が現れますが、照合する文字集合は維持します。

## 正規表現の潜在的な問題の検出

After EffectsのExtendScriptでは、選択肢と省略可能な要素を含む繰り返しが停止する場合（EC-18）や、繰り返し内の入れ子の選択肢が誤った一致結果を返す場合（EC-19）があります。実機での再現条件と比較結果は[調査記録](https://github.com/YukiWorks432/extendscript-compat/blob/c313a4c5305f947bfcf996d5ff743858aa4c6487/docs/evidence/regexp-risks-ae-26.5.json)を参照してください。

この検出は既定では無効です。Rollupで有効にすると、最終出力の正規表現リテラルを検査します。

```js
extendscriptCompat({ regexpDiagnostics: "warn" }); // 警告する
extendscriptCompat({ regexpDiagnostics: "error" }); // 検出時にビルドを停止する
```

`regexpDiagnostics`は`diagnostics`とは独立した設定で、既定値は`"off"`です。通知位置はBOMや互換性補正を適用する前の最終出力上の位置です。診断によるコードの書き換えは行いません。

直接解析する場合は`findRegExpRisks(source)`を使います。`code`、`kind`、`start`、`end`、`line`、`column`、`message`を返し、位置は入力コードに対するものです。行は1始まり、列と文字位置はUTF-16のコード単位で0始まりです。

```js
import { findRegExpRisks } from "extendscript-compat";

findRegExpRisks("var pattern = /^((a|b)|c)+$/;"); // EC-19の可能性を通知
```

EC-18では、2回以上繰り返しうるグループ内に選択肢と省略可能な要素がある形を検出します。EC-19では、2回以上繰り返しうるグループ内に入れ子の選択肢がある形を検出します。これは構造に基づく目安であり、検出されても実際に問題が起きるとは限らず、検出されなくても安全とは限りません。正規表現リテラルのうちフラグが`g`・`i`・`m`のみの構文解析可能なものが対象です。`RegExp`コンストラクタ、動的な文字列、`eval`内の文字列、外部ファイルなどは対象外です。

書き換え後もキャプチャや正規表現の参照結果を含む動作が保たれることを一般には保証できないため、自動補正はしません。通知された式は、入力と使用方法に応じて実機で確認してください。

## 関連する実装

同じ不具合への対処は既存のツールにもあります。2026年10月26日時点で、次の実装を確認しました。

- [babel-preset-extendscript](https://github.com/fusepilot/babel-preset-extendscript): Babelのプリセットとして、入れ子の三項演算子を括弧で囲みます。多くの構文変換や互換機能も含みます。
- [UglifyJS](https://github.com/mishoo/UglifyJS#output-options): `output.extendscript: true` で入れ子の三項演算子を保護します。npmの3.19.3で、`a || b && c` への括弧追加は行われないことを確認しました。
- [extendscript-minimizer](https://github.com/gmeeker/extendscript-minimizer/blob/master/transforms/transform.precedence.js): Closure Compilerとjscodeshiftを使うツールで、両方の不具合を明示的な括弧で保護します。今回の調査時点ではnpmの同名パッケージを取得できませんでした。

extendscript-compatは生成済みコードへの括弧挿入、診断・検査API、Rollupでのソースマップ更新をまとめて提供します。既存の変換処理や圧縮器と組み合わせ、生成処理の最後に組み込む用途を想定しています。

## 開発

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm pack --pack-destination artifacts
```

試験では真偽値の組み合わせ、副作用の順序と回数、既存括弧、繰り返し適用、圧縮後の出力、ソースマップを確認します。実機での対応範囲と生成物の証跡はPRの検証結果に記録します。

MIT License。

ponyfillを含むinclude展開は、モジュール処理か先行するrenderChunkで、補完を参照できるスコープ内へ済ませてください。generateBundleで追加する補完対象やIIFEの外側の呼び出しは、未変換のまま成功扱いにせずエラーにします。Object.createと属性APIの補完範囲はこの変更では拡張しません。
