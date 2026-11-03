// ECMA-262 5.1 15.12: JSON文法とreviverから導いた、Node・AE共用の契約。
(function () {
  var total = 0;
  var failures = [];
  function check(name, actual, expected) {
    total++;
    if (actual !== expected)
      failures.push(name + ": " + String(actual) + " !== " + String(expected));
  }
  var invalid = [
    "",
    " ",
    "undefined",
    "NaN",
    "Infinity",
    "-Infinity",
    "+1",
    ".1",
    "1.",
    "01",
    "-01",
    "00",
    "--1",
    "-",
    "1e",
    "1e+",
    "1e-",
    "0x10",
    "0b1",
    "0o7",
    "true false",
    "nullx",
    "False",
    "[1,]",
    "[,1]",
    "[1,,2]",
    "[1 2]",
    "[",
    '{"a":1,}',
    '{"a":}',
    '{"a" 1}',
    "{a:1}",
    "{'a':1}",
    '{"a":1 "b":2}',
    "{",
    '{"a":1',
    "[1",
    "/*x*/null",
    "//x\nnull",
    '"\\x41"',
    '"\\v"',
    '"\\0"',
    '"\\u12"',
    '"\\u12G4"',
    '"\\u12345',
    '"abc',
    '"\\',
    '"a" "b"',
    "(null)",
    "null;",
    '"\n"',
    '"\r"',
    '"\t"',
    "\u00a0null",
    "\ufeffnull",
    "\u2028null",
    "\u2029null",
    "\vnull",
    "\fnull"
  ];
  var i;
  for (i = 0; i < 32; i++) invalid.push('"' + String.fromCharCode(i) + '"');
  for (i = 0; i < invalid.length; i++) {
    var errorName = "accepted";
    var calls = 0;
    try {
      JSON.parse(invalid[i], function (key, value) {
        calls++;
        return value;
      });
    } catch (error) {
      errorName = error instanceof SyntaxError ? "SyntaxError" : String(error);
    }
    check("不正入力 " + i, errorName, "SyntaxError");
    check("不正入力でreviverを呼ばない " + i, calls, 0);
  }
  var scalars = [
    ["null", null],
    ["true", true],
    ["false", false],
    ["0", 0],
    ["-1", -1],
    ["1.25", 1.25],
    ["1e2", 100],
    ["1E-2", 0.01],
    ["-2.5e+2", -250],
    ["1e400", Infinity],
    ["-1e400", -Infinity],
    ['""', ""],
    ['"a\\n\\t\\b\\f\\r\\/\\"\\\\b"', 'a\n\t\b\f\r/"\\b'],
    ['"\\u0000\\u00aF\\u200c\\u200d\\ufeff"', "\u0000\u00af\u200c\u200d\ufeff"],
    ['"\\ud83d\\ude00"', "\ud83d\ude00"],
    ['"\\ud800"', "\ud800"],
    ['"\\udc00"', "\udc00"],
    [" \t\r\n42 \n\r\t ", 42]
  ];
  for (i = 0; i < scalars.length; i++) {
    check("値 " + i, JSON.parse(scalars[i][0]), scalars[i][1]);
  }
  var unicode = String.fromCharCode(0x200c, 0x200d, 0xfeff, 0x2028, 0x2029);
  check("文字列内のUnicodeを保持", JSON.parse('"' + unicode + '"'), unicode);
  check("負のゼロ", 1 / JSON.parse("-0"), -Infinity);
  check("負のアンダーフロー", 1 / JSON.parse("-1e-400"), -Infinity);
  var value = JSON.parse('{"a":[1,{"b":true},null],"\\u0063":"x","a2":[],"o":{}}');
  check("配列", value.a[0], 1);
  check("入れ子のオブジェクト", value.a[1].b, true);
  check("null", value.a[2], null);
  check("エスケープされたキー", value.c, "x");
  check("空配列", value.a2.length, 0);
  check("オブジェクトのプロトタイプ", typeof value.o.toString, "function");
  check(
    "余分な__proto__を作らない",
    Object.prototype.hasOwnProperty.call(value.o, "__proto__"),
    false
  );
  check("重複キーは最後の値", JSON.parse('{"x":1,"x":2}').x, 2);
  var own = JSON.parse('{"__proto__":{"probe":7},"constructor":2,"hasOwnProperty":3}');
  check(
    "__proto__は自身のプロパティ",
    Object.prototype.hasOwnProperty.call(own, "__proto__"),
    true
  );
  check("__proto__の値", own["__proto__"].probe, 7);
  check("プロトタイプを変更しない", own.probe, undefined);
  check("constructorの値", own.constructor, 2);
  check("hasOwnPropertyの値", own.hasOwnProperty, 3);
  check("重複した__proto__", JSON.parse('{"__proto__":1,"__proto__":2}')["__proto__"], 2);
  var order = [];
  var holders = true;
  var revived = JSON.parse('{"a":[{"x":1},2]}', function (key, current) {
    order.push(key);
    if (this[key] !== current) holders = false;
    return typeof current === "number" ? current + 1 : current;
  });
  check("reviverの訪問順", order.join(","), "x,0,1,a,");
  check("reviverのthis", holders, true);
  check("reviverによる置換", revived.a[0].x, 2);
  var removed = JSON.parse("[1,2]", function (key, current) {
    return key === "0" ? undefined : current;
  });
  check("reviverで削除しても配列長を保持", removed.length, 2);
  check("reviverが返すundefinedは削除", Object.prototype.hasOwnProperty.call(removed, "0"), false);
  check(
    "ルートの置換",
    JSON.parse("1", function () {
      return 9;
    }),
    9
  );
  check(
    "ルートの削除",
    JSON.parse("1", function () {
      return undefined;
    }),
    undefined
  );
  var visited = [];
  JSON.parse('{"a":1,"b":2}', function (key, current) {
    visited.push(key);
    if (key === "a") {
      delete this.b;
      this.c = 3;
    }
    if (key === "b") check("削除済みの次の値", current, undefined);
    return current;
  });
  check("訪問するキーは処理前に確定", visited.join(","), "a,b,");
  var conversions = 0;
  check(
    "入力の文字列化",
    JSON.parse({
      toString: function () {
        conversions++;
        return "3";
      }
    }),
    3
  );
  check("文字列化は一度", conversions, 1);
  check("関数以外のreviverを無視", JSON.parse("4", {}), 4);
  check(
    "reviverからの入れ子呼び出し",
    JSON.parse('{"a":1}', function (key, current) {
      if (key === "a") return JSON.parse("5");
      return current;
    }).a,
    5
  );
  var expected = new Error("reviver");
  var received;
  try {
    JSON.parse("1", function () {
      throw expected;
    });
  } catch (caught) {
    received = caught;
  }
  check("reviverの例外を保持", received, expected);
  return { total: total, failures: failures };
})();
