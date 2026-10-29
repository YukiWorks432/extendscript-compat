(function () {
  var failures = [],
    total = 0;
  function check(name, actual, expected) {
    total++;
    if (actual !== expected)
      failures.push(name + ": " + String(actual) + " !== " + String(expected));
  }
  function assertThrows(name, action) {
    total++;
    try {
      action();
      failures.push(name + ": no exception");
    } catch (e) {
      if (!(e instanceof TypeError)) failures.push(name + ": " + String(e));
    }
  }
  check("literal all", "aba".replaceAll("a", "x"), "xbx");
  check("literal no match", "abc".replaceAll("z", "x"), "abc");
  check("literal metacharacters", "a.b.a".replaceAll(".", "x"), "axbxa");
  check("literal overlap", "aaa".replaceAll("aa", "x"), "xa");
  check("literal empty", "ab".replaceAll("", "-"), "-a-b-");
  check("empty input and search", "".replaceAll("", "x"), "x");
  check("literal empty output", "aaa".replaceAll("a", ""), "");
  check("literal dollar dollar", "aa".replaceAll("a", "$$"), "$$");
  check("literal matched token", "aba".replaceAll("a", "<$&>"), "<a>b<a>");
  check("literal unmatched capture token", "a".replaceAll("a", "$1"), "$1");
  check("literal prefix token", "aba".replaceAll("a", "$" + String.fromCharCode(96)), "bab");
  check("literal suffix token", "aba".replaceAll("a", "$" + String.fromCharCode(39)), "bab");
  var calls = [];
  var replaced = "aba".replaceAll("a", function (match, index, text) {
    calls.push(match + ":" + index + ":" + text);
    return index;
  });
  check("literal callback result", replaced, "0b2");
  check("literal callback args", calls.join(","), "a:0:aba,a:2:aba");
  check(
    "callback return is literal",
    "aa".replaceAll("a", function () {
      return "$&";
    }),
    "$&$&"
  );
  check("literal null search", "null-null".replaceAll(null, "x"), "x-x");
  check("literal undefined search", "undefined".replaceAll(undefined, "x"), "x");
  check("literal undefined replacement", "aa".replaceAll("a", undefined), "undefinedundefined");
  check("generic receiver", String.prototype.replaceAll.call(121, 1, "x"), "x2x");
  var conversions = 0,
    search = {
      toString: function () {
        conversions++;
        return "a";
      }
    };
  check("search coercion result", "aba".replaceAll(search, "x"), "xbx");
  check("search coercion once", conversions, 1);
  conversions = 0;
  var replacement = {
    toString: function () {
      conversions++;
      return "x";
    }
  };
  check("replacement coercion result", "aba".replaceAll("a", replacement), "xbx");
  check("replacement coercion once", conversions, 1);
  check("regex global", "aba".replaceAll(/a/g, "x"), "xbx");
  check("regex captures", "ab ab".replaceAll(/(a)(b)/g, "$2$1"), "ba ba");
  check("regex unmatched capture", "ab".replaceAll(/(a)|(b)/g, "$1-$2"), "a--b");
  check("regex empty terminal", "ab".replaceAll(/(?:)/g, "-"), "-a-b-");
  check("regex empty input", "".replaceAll(/(?:)/g, "-"), "-");
  var rx = /a/g;
  rx.lastIndex = 2;
  check("regex starts at zero", "aba".replaceAll(rx, "x"), "xbx");
  check("regex resets lastIndex", rx.lastIndex, 0);
  rx.lastIndex = 2;
  var seen = [];
  "aba".replaceAll(rx, function () {
    seen.push(rx.lastIndex);
    rx.lastIndex = 7;
    return "x";
  });
  check("regex callback state", seen.join(","), "0,7");
  check("regex callback mutation retained", rx.lastIndex, 7);
  rx.lastIndex = 2;
  var observed = -1;
  var regexReplacement = {
    toString: function () {
      observed = rx.lastIndex;
      return "x";
    }
  };
  check("regex replacement conversion", "aba".replaceAll(rx, regexReplacement), "xbx");
  check("regex conversion precedes reset", observed, 2);

  assertThrows("regex nonglobal", function () {
    // oxlint-disable-next-line bad-replace-all-arg -- 非globalを拒否する契約を確認する
    "aba".replaceAll(/a/, "x");
  });
  var high = String.fromCharCode(0xd800),
    low = String.fromCharCode(0xdc00),
    rep = String.fromCharCode(0xfffd);
  check("empty well formed", "".isWellFormed(), true);
  check("ascii well formed", "abc".isWellFormed(), true);
  check("pair well formed", (high + low).isWellFormed(), true);
  check("high not well formed", high.isWellFormed(), false);
  check("low not well formed", low.isWellFormed(), false);
  check("reversed pair not well formed", (low + high).isWellFormed(), false);
  check("surrogate range high boundary", String.fromCharCode(0xdbff, 0xdfff).isWellFormed(), true);
  check("BMP boundary", String.fromCharCode(0xd7ff, 0xe000).isWellFormed(), true);
  check("pair unchanged", (high + low).toWellFormed(), high + low);
  check("high repaired", high.toWellFormed(), rep);
  check("low repaired", low.toWellFormed(), rep);
  check("adjacent high repaired", (high + high + low).toWellFormed(), rep + high + low);
  check("adjacent low repaired", (high + low + low).toWellFormed(), high + low + rep);
  check(
    "mixed repaired",
    ("a" + low + "b" + high + "c").toWellFormed(),
    "a" + rep + "b" + rep + "c"
  );
  check("nul retained", String.fromCharCode(0).toWellFormed().length, 1);
  check("noncharacter retained", String.fromCharCode(0xffff).toWellFormed().charCodeAt(0), 0xffff);
  check(
    "no normalization",
    ("e" + String.fromCharCode(0x301)).toWellFormed(),
    "e" + String.fromCharCode(0x301)
  );
  check("well formed generic", String.prototype.isWellFormed.call(12), true);
  check("repair generic", String.prototype.toWellFormed.call(12), "12");
  conversions = 0;
  var value = {
    toString: function () {
      conversions++;
      return high;
    }
  };
  check("repair coercion", String.prototype.toWellFormed.call(value), rep);
  check("repair coercion once", conversions, 1);
  return { total: total, passed: total - failures.length, failures: failures };
})();
