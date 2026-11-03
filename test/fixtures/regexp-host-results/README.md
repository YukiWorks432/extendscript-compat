# 正規表現の実機比較資料

After Effects 26.5x89 / ExtendScript 4.5.6、Windowsで2026年10月29日に取得した結果です。[原記録](https://github.com/YukiWorks432/extendscript-compat/tree/c313a4c5305f947bfcf996d5ff743858aa4c6487/docs/evidence/regexp-risks-ae-26.5)から、既存テストが読む2ファイルを内容を変えず移しました。

EC-18は156入力の一致位置・文字列・キャプチャ、EC-19は85入力の真偽値をNodeの標準的な結果と比較します。EC-19の元の式には24件の不一致があり、候補の式にはありません。有限の入力に対する実機結果の検査であり、一般的な等価性や現在のホストでの再実行を保証しません。
