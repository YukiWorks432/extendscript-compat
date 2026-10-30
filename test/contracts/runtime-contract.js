(function () {
  var cases = [];
  function add(name, run, expected) {
    cases.push({ name: name, run: run, expected: expected });
  }
  function equal(left, right) {
    if (left === right) return left !== 0 || 1 / left === 1 / right;
    if (typeof left === "number" && typeof right === "number")
      return left !== left && right !== right;
    if (left instanceof Array && right instanceof Array) {
      if (left.length !== right.length) return false;
      for (var i = 0; i < left.length; i++) {
        if (!equal(left[i], right[i])) return false;
      }
      return true;
    }
    return false;
  }
  add(
    "parseInt: invalid first digit",
    function () {
      return parseInt(":", 11);
    },
    NaN,
  );
  add(
    "parseInt: invalid hex first digit",
    function () {
      return parseInt("=", 16);
    },
    NaN,
  );
  add(
    "parseInt: invalid suffix",
    function () {
      return parseInt("a?", 16);
    },
    10,
  );
  add(
    "parseInt: auto hex prefix",
    function () {
      return parseInt("0xa?");
    },
    10,
  );
  add(
    "parseInt: signed hex prefix",
    function () {
      return parseInt(" \t-0Xf?", 16);
    },
    -15,
  );
  add(
    "parseInt: base 36",
    function () {
      return parseInt("Z!x", 36);
    },
    35,
  );
  add(
    "parseInt: base 2",
    function () {
      return parseInt("1012", 2);
    },
    5,
  );
  add(
    "parseInt: invalid radix",
    function () {
      return parseInt("1", 37);
    },
    NaN,
  );
  add(
    "parseInt: signed zero",
    function () {
      return parseInt("-0?", 16);
    },
    -0,
  );
  add(
    "parseInt: empty prefix",
    function () {
      return parseInt("0x?", 16);
    },
    NaN,
  );
  add(
    "parseInt: radix ToInt32",
    function () {
      return parseInt("a?", 4294967312);
    },
    10,
  );
  add(
    "parseInt: coercion order once",
    function () {
      var log = [];
      var value = {
        toString: function () {
          log.push("input");
          return "a?";
        },
      };
      var radix = {
        valueOf: function () {
          log.push("radix");
          return 16;
        },
      };
      var number = parseInt(value, radix);
      return [number, log.join(",")];
    },
    [10, "input,radix"],
  );
  add(
    "parseInt: numeric receiver",
    function () {
      return parseInt(31, 16);
    },
    49,
  );
  add(
    "parseInt: NUL terminates digits",
    function () {
      return parseInt("a\0f", 16);
    },
    10,
  );

  add(
    "charAt: NUL",
    function () {
      return "x\0y".charAt(1);
    },
    "\0",
  );
  add(
    "charAt: default",
    function () {
      return "abc".charAt();
    },
    "a",
  );
  add(
    "charAt: negative",
    function () {
      return "abc".charAt(-1);
    },
    "",
  );
  add(
    "charAt: outside",
    function () {
      return "abc".charAt(3);
    },
    "",
  );
  add(
    "charAt: fraction",
    function () {
      return "abc".charAt(1.9);
    },
    "b",
  );
  add(
    "charAt: NaN",
    function () {
      return "abc".charAt(NaN);
    },
    "a",
  );
  add(
    "charAt: Infinity",
    function () {
      return "abc".charAt(Infinity);
    },
    "",
  );
  add(
    "charAt: empty",
    function () {
      return "".charAt(0);
    },
    "",
  );
  add(
    "charAt: boxed string",
    function () {
      return new String("a\0").charAt(1);
    },
    "\0",
  );
  add(
    "charAt: UTF16 code unit",
    function () {
      return "a\uD83D\uDE00".charAt(1).charCodeAt(0);
    },
    0xd83d,
  );
  add(
    "charAt: generic receiver once",
    function () {
      var count = 0;
      var object = {
        toString: function () {
          count++;
          return "a\0";
        },
      };
      return [String.prototype.charAt.call(object, 1), count];
    },
    ["\0", 1],
  );

  add(
    "split: trailing empty regex",
    function () {
      return "ab".split(/b/);
    },
    ["a", ""],
  );
  add(
    "split: trailing empty string",
    function () {
      return "ab".split("b");
    },
    ["a", ""],
  );
  add(
    "split: repeated delimiter",
    function () {
      return "abb".split(/b/);
    },
    ["a", "", ""],
  );
  add(
    "split: leading delimiter",
    function () {
      return "ab".split(/a/);
    },
    ["", "b"],
  );
  add(
    "split: no match",
    function () {
      return "ab".split(/z/);
    },
    ["ab"],
  );
  add(
    "split: empty input",
    function () {
      return "".split(/.?/);
    },
    [],
  );
  add(
    "split: empty input nonmatching",
    function () {
      return "".split(/z/);
    },
    [""],
  );
  add(
    "split: empty matches",
    function () {
      return "abc".split(/(?:)/);
    },
    ["a", "b", "c"],
  );
  add(
    "split: word boundaries at the end",
    function () {
      return "a b".split(/\b/);
    },
    ["a", " ", "b"],
  );
  add(
    "split: consuming match at the end",
    function () {
      return "ab".split(/b\b/);
    },
    ["a", ""],
  );
  add(
    "split: capture",
    function () {
      return "a-b".split(/(-)/);
    },
    ["a", "-", "b"],
  );
  add(
    "split: nonparticipating capture",
    function () {
      return "a-b".split(/(-)|(,)/);
    },
    ["a", "-", void 0, "b"],
  );
  add(
    "split: zero limit",
    function () {
      return "ab".split(/b/, 0);
    },
    [],
  );
  add(
    "split: negative limit",
    function () {
      return "ab".split(/b/, -1);
    },
    ["a", ""],
  );
  add(
    "split: truncated limit",
    function () {
      return "a-b-c".split(/-/, 2);
    },
    ["a", "b"],
  );
  add(
    "split: limit NaN",
    function () {
      return "ab".split(/b/, NaN);
    },
    [],
  );
  add(
    "split: undefined separator zero limit",
    function () {
      return "ab".split(void 0, 0);
    },
    [],
  );
  add(
    "split: NUL in source",
    function () {
      return "a\0b".split(/b/);
    },
    ["a\0", ""],
  );
  add(
    "split: caller lastIndex",
    function () {
      var regex = /b/g;
      regex.lastIndex = 1;
      return ["ab".split(regex), regex.lastIndex];
    },
    [["a", ""], 1],
  );
  add(
    "split: string coercion once",
    function () {
      var count = 0;
      var object = {
        toString: function () {
          count++;
          return "ab";
        },
      };
      return [String.prototype.split.call(object, /b/), count];
    },
    [["a", ""], 1],
  );

  add(
    "replace: nonparticipating capture",
    function () {
      return "b".replace(/(a)|(b)/, "$1$2");
    },
    "b",
  );
  add(
    "replace: full match",
    function () {
      return "abc".replace(/b/, "[$&]");
    },
    "a[b]c",
  );
  add(
    "replace: literal dollar",
    function () {
      return "abc".replace(/b/, "$$");
    },
    "a$c",
  );
  add(
    "replace: prefix",
    function () {
      return "abc".replace(/b/, "$\x60");
    },
    "aac",
  );
  add(
    "replace: suffix",
    function () {
      return "abc".replace(/b/, "$'");
    },
    "acc",
  );
  add(
    "replace: two digit fallback",
    function () {
      return "a".replace(/(a)/, "$10");
    },
    "a0",
  );
  add(
    "replace: leading zero group",
    function () {
      return "a".replace(/(a)/, "$01");
    },
    "a",
  );
  add(
    "replace: absent group stays literal",
    function () {
      return "a".replace(/(a)/, "$20");
    },
    "$20",
  );
  add(
    "replace: group zero stays literal",
    function () {
      return "a".replace(/(a)/, "$0/$00");
    },
    "$0/$00",
  );
  add(
    "replace: actual group ten",
    function () {
      return "abcdefghij".replace(/(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)/, "$10$1");
    },
    "ja",
  );
  add(
    "replace: final dollar",
    function () {
      return "ab".replace(/b/, "$");
    },
    "a$",
  );
  add(
    "replace: source NUL",
    function () {
      return "a\0b".replace(/b/, "c");
    },
    "a\0c",
  );
  add(
    "replace: replacement NUL",
    function () {
      return "ab".replace(/b/, "\0");
    },
    "a\0",
  );
  add(
    "replace: global",
    function () {
      return "bab".replace(/(a)|(b)/g, "$1$2");
    },
    "bab",
  );
  add(
    "replace: string search",
    function () {
      return "abc".replace("b", "$1/$&");
    },
    "a$1/bc",
  );
  add(
    "replace: numeric replacement",
    function () {
      return "abc".replace("b", 12);
    },
    "a12c",
  );
  add(
    "replace: callback args and count",
    function () {
      var log = [];
      var value = "bb".replace(/(a)|(b)/g, function (match, a, b, index, input) {
        log.push([match, typeof a, b, index, input].join(":"));
        return index;
      });
      return [value, log.join(",")];
    },
    ["01", "b:undefined:b:0:bb,b:undefined:b:1:bb"],
  );
  add(
    "replace: coercion order once",
    function () {
      var log = [];
      var receiver = {
        toString: function () {
          log.push("input");
          return "abc";
        },
      };
      var search = {
        toString: function () {
          log.push("search");
          return "b";
        },
      };
      var replacement = {
        toString: function () {
          log.push("replacement");
          return "x";
        },
      };
      var value = String.prototype.replace.call(receiver, search, replacement);
      return [value, log.join(",")];
    },
    ["axc", "input,search,replacement"],
  );

  add(
    "parseInt: not constructible",
    function () {
      try {
        new parseInt("12", 10);
        return false;
      } catch (error) {
        return error instanceof TypeError;
      }
    },
    true,
  );
  add(
    "split: ignore case",
    function () {
      return "aB".split(/b/i);
    },
    ["a", ""],
  );
  add(
    "split: infinite limit",
    function () {
      return "ab".split(/b/, Infinity);
    },
    [],
  );
  add(
    "replace: callback length changes",
    function () {
      var log = [];
      var value = "bb".replace(/b/g, function (m, p, input) {
        log.push([p, input].join(":"));
        return "xxxx";
      });
      return [value, log.join(",")];
    },
    ["xxxxxxxx", "0:bb,1:bb"],
  );
  add(
    "replace: empty string search",
    function () {
      return "ab".replace("", "-");
    },
    "-ab",
  );
  add(
    "replace: regex empty input",
    function () {
      return "".replace(/(?:)/, "-");
    },
    "-",
  );
  add(
    "replace: regex empty global input",
    function () {
      return "".replace(/(?:)/g, "-");
    },
    "-",
  );
  add(
    "replace: zero width global",
    function () {
      return "ab".replace(/(?:)/g, "-");
    },
    "-a-b-",
  );
  add(
    "replace: no match callback",
    function () {
      var calls = 0;
      var value = "ab".replace(/z/g, function () {
        calls++;
        return "x";
      });
      return [value, calls];
    },
    ["ab", 0],
  );
  add(
    "replace: callback exception once",
    function () {
      var calls = 0;
      var expected = {};
      try {
        "b".replace(/b/, function () {
          calls++;
          throw expected;
        });
      } catch (error) {
        return [error === expected, calls];
      }
      return [false, calls];
    },
    [true, 1],
  );
  var failures = [];
  for (var i = 0; i < cases.length; i++) {
    var item = cases[i];
    try {
      var actual = item.run();
      if (!equal(actual, item.expected)) {
        failures.push({ name: item.name, actual: String(actual), expected: String(item.expected) });
      }
    } catch (error) {
      failures.push({ name: item.name, error: String(error) });
    }
  }
  return { total: cases.length, passed: cases.length - failures.length, failures: failures };
})();
