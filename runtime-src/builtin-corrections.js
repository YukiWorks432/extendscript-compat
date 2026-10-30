/*!
 * split is adapted from es5-shim v4.6.7 (MIT).
 * Copyright (C) 2009-2016 Kristopher Michael Kowal and contributors.
 * See ../THIRD-PARTY-LICENSES.txt and README.md for provenance.
 */
(function (root) {
  // $.evalFileや別バンドルによる再評価でも、同じ関数を重ねて包まない。
  if (root.__extendscriptCompatRuntime__ === 1) return;
  var stringPrototype = String.prototype;
  var originalParseInt = root.parseInt;
  var originalSplit = stringPrototype.split;
  var originalReplace = stringPrototype.replace;
  var charCodeAt = stringPrototype.charCodeAt;
  var slice = stringPrototype.slice;
  var objectToString = Object.prototype.toString;
  var exec = RegExp.prototype.exec;
  var arraySlice = Array.prototype.slice;
  var push = Array.prototype.push;
  var compliantExecNpcg = typeof /()??/.exec("")[1] === "undefined";

  root.parseInt = function parseInt(value, radix) {
    if (this instanceof parseInt) throw new TypeError("parseInt is not a constructor");
    var text = String(value);
    var base = Number(radix) >> 0;
    if (base !== 0) {
      if (base < 2 || base > 36) return NaN;
    }
    var start = 0;
    // Unicodeの空白を含む正規表現は、テンプレートIssue #1のevalFile問題を避ける。
    while (start < text.length) {
      var code = charCodeAt.call(text, start);
      if (code >= 0x2000 && code <= 0x200a) {
        start++;
      } else if (
        code === 9 ||
        code === 10 ||
        code === 11 ||
        code === 12 ||
        code === 13 ||
        code === 32 ||
        code === 0xa0 ||
        code === 0x1680 ||
        code === 0x180e ||
        code === 0x2028 ||
        code === 0x2029 ||
        code === 0x202f ||
        code === 0x205f ||
        code === 0x3000 ||
        code === 0xfeff
      ) {
        start++;
      } else {
        break;
      }
    }
    var sign = "";
    var first = charCodeAt.call(text, start);
    if (first === 43 || first === 45) {
      sign = slice.call(text, start, start + 1);
      start++;
    }
    if (base === 0 || base === 16) {
      if (charCodeAt.call(text, start) === 48) {
        var prefix = charCodeAt.call(text, start + 1);
        if (prefix === 88 || prefix === 120) {
          base = 16;
          start += 2;
        }
      }
    }
    // 基数省略時の旧8進数解釈や、10以下の基数の挙動は元の関数へ委ねる。
    if (base <= 10) return originalParseInt(text, base);
    var end = start;
    while (end < text.length) {
      var digitCode = charCodeAt.call(text, end);
      var digit = digitCode - 48;
      if (digitCode >= 65 && digitCode <= 90) digit = digitCode - 55;
      else if (digitCode >= 97 && digitCode <= 122) digit = digitCode - 87;
      else if (digitCode < 48 || digitCode > 57) break;
      if (digit >= base) break;
      end++;
    }
    if (end === start) return NaN;
    return originalParseInt(sign + slice.call(text, start, end), base);
  };

  stringPrototype.charAt = function charAt(position) {
    var code = charCodeAt.call(String(this), position);
    return code !== code ? "" : String.fromCharCode(code);
  };

  // es5-shimの分割処理をES3に限定して取り込む。元のRegExpのlastIndexは変更しない。
  stringPrototype.split = function split(separator, limit) {
    var string = String(this);
    if (objectToString.call(separator) !== "[object RegExp]") {
      return originalSplit.call(string, separator, limit);
    }
    var splitLimit = typeof limit === "undefined" ? 0xffffffff : limit >>> 0;
    if (splitLimit === 0) return [];
    var output = [];
    var flags = (separator.ignoreCase ? "i" : "") + (separator.multiline ? "m" : "");
    var separatorCopy = new RegExp(separator.source, flags + "g");
    // AEのglobalなexecは空の入力に一致しないため、空一致は非globalで調べる。
    var emptyMatcher = new RegExp(separator.source, flags);
    if (string.length === 0) return exec.call(emptyMatcher, "") === null ? [""] : [];
    var separator2;
    if (!compliantExecNpcg) {
      separator2 = new RegExp("^" + separatorCopy.source + "$(?!\\s)", flags);
    }
    var lastLastIndex = 0;
    var lastLength = 0;
    var match = exec.call(separatorCopy, string);
    while (match) {
      var lastIndex = match.index + match[0].length;
      if (lastIndex > lastLastIndex) {
        push.call(output, slice.call(string, lastLastIndex, match.index));
        if (!compliantExecNpcg && match.length > 1) {
          originalReplace.call(match[0], separator2, function () {
            for (var i = 1; i < arguments.length - 2; i++) {
              if (typeof arguments[i] === "undefined") match[i] = void 0;
            }
          });
        }
        if (match.length > 1 && match.index < string.length) {
          push.apply(output, arraySlice.call(match, 1));
        }
        lastLength = match[0].length;
        lastLastIndex = lastIndex;
        if (output.length >= splitLimit) break;
      }
      if (separatorCopy.lastIndex === match.index) separatorCopy.lastIndex++;
      match = exec.call(separatorCopy, string);
    }
    if (lastLastIndex === string.length) {
      // 末尾で文字を消費した区切りだけが、最後の空要素を作る。
      if (lastLength) push.call(output, "");
    } else {
      push.call(output, slice.call(string, lastLastIndex));
    }
    return output.length > splitLimit ? arraySlice.call(output, 0, splitLimit) : output;
  };

  stringPrototype.replace = function replace(searchValue, replaceValue) {
    var string = String(this);
    var search = searchValue;
    var isRegex = objectToString.call(search) === "[object RegExp]";
    if (!isRegex) search = String(search);
    var isFunction = typeof replaceValue === "function";
    var replacement = isFunction ? "" : String(replaceValue);
    var output = "";
    var cursor = 0;
    var terminalHandled = false;

    function appendMatch(match) {
      var args = arraySlice.call(arguments);
      var captureCount = args.length - 3;
      var position = args[args.length - 2];
      args[args.length - 1] = string;
      if (position === string.length && match.length === 0) terminalHandled = true;
      var result = "";
      if (isFunction) {
        result = String(replaceValue.apply(this, args));
      } else {
        for (var i = 0; i < replacement.length; i++) {
          var code = charCodeAt.call(replacement, i);
          if (code === 36) {
            var next = charCodeAt.call(replacement, i + 1);
            if (next === 36) {
              result += "$";
              i++;
              continue;
            }
            if (next === 38) {
              result += match;
              i++;
              continue;
            }
            if (next === 96) {
              result += slice.call(string, 0, position);
              i++;
              continue;
            }
            if (next === 39) {
              result += slice.call(string, position + match.length);
              i++;
              continue;
            }
            if (next >= 48 && next <= 57) {
              var number = next - 48;
              var second = charCodeAt.call(replacement, i + 2) - 48;
              if (second >= 0 && second <= 9) {
                var pair = number * 10 + second;
                if (pair > 0 && pair <= captureCount) {
                  number = pair;
                  i++;
                }
              }
              if (number > 0 && number <= captureCount) {
                var captured = args[number];
                if (typeof captured !== "undefined") result += captured;
                i++;
                continue;
              }
            }
          }
          result += slice.call(replacement, i, i + 1);
        }
      }
      output += slice.call(string, cursor, position) + result;
      cursor = position + match.length;
      // AEが途中の置換結果を次の検索やコールバックへ渡さないよう、元の一致を返す。
      return match;
    }

    if (isRegex) {
      originalReplace.call(string, search, appendMatch);
      // AEのglobal置換が落とす末尾の空一致を、元の入力上で一度だけ補う。
      if (search.global && !terminalHandled) {
        var flags = (search.ignoreCase ? "i" : "") + (search.multiline ? "m" : "");
        var terminal = new RegExp("(?![\\s\\S])(?:" + search.source + ")", flags);
        originalReplace.call(string, terminal, appendMatch);
      }
    } else {
      // AEは文字列検索のコールバックを呼ばないため、最初の一致を直接処理する。
      var position = string.indexOf(search);
      if (position >= 0) appendMatch(search, position, string);
    }
    return output + slice.call(string, cursor);
  };

  root.__extendscriptCompatRuntime__ = 1;
})(typeof $ === "undefined" ? globalThis : $.global);
