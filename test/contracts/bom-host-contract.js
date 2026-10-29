// 実機とNodeの両方で、元の文字と正規表現の意味を確認する。
export function run() {
  var text = "A ‌‍﻿あZ";
  var expected = "A" + String.fromCharCode(0x00a0, 0x200c, 0x200d, 0xfeff) + "あZ";
  // oxlint-disable-next-line no-misleading-character-class -- 個々の不可視文字を検証する。
  var pattern = /[‌‍﻿]/;
  return {
    textMatches: text === expected,
    patternMatches:
      pattern.test(String.fromCharCode(0x200c)) &&
      pattern.test(String.fromCharCode(0x200d)) &&
      pattern.test(String.fromCharCode(0xfeff)),
    patternRejects: !pattern.test("A")
  };
}
