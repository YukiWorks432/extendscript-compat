(function () {
  var failures = [],
    total = 0;
  function check(name, actual, expected) {
    total++;
    if (actual !== expected)
      failures.push(name + ": " + String(actual) + " !== " + String(expected));
  }
  check(
    "入れ子呼び出し後も外側の置換関数を適用する",
    JSON.stringify({ a: 1, hidden: 2 }, function (key, value) {
      if (key === "a") JSON.stringify({ x: 1 });
      return key === "hidden" ? undefined : value;
    }),
    '{"a":1}'
  );
  check(
    "内側の置換関数を外側へ持ち越さない",
    JSON.stringify({ a: 1, b: 2 }, function (key, value) {
      if (key === "a")
        JSON.stringify(1, function () {
          return "inner";
        });
      return value;
    }),
    '{"a":1,"b":2}'
  );
  var child = {
    toJSON: function () {
      JSON.stringify({ x: 1 }, ["x"], "\t");
      return { n: 2 };
    }
  };
  check(
    "toJSONから呼び出しても字下げと選択を保持する",
    JSON.stringify(
      { child: child, hidden: 3 },
      function (key, value) {
        return key === "hidden" ? undefined : value;
      },
      2
    ),
    '{\n  "child": {\n    "n": 2\n  }\n}'
  );
  check(
    "内側の例外を捕捉しても外側を継続する",
    JSON.stringify({ a: 1, hidden: 2 }, function (key, value) {
      if (key === "a") {
        try {
          JSON.stringify(0, function () {
            throw new Error("inner");
          });
        } catch (error) {
          if (error.message !== "inner") throw error;
        }
      }
      return key === "hidden" ? undefined : value;
    }),
    '{"a":1}'
  );
  check(
    "数値と重複した文字列のキー",
    JSON.stringify({ 1: "one", a: 2 }, [1, "a", "a"]),
    '{"1":"one","a":2}'
  );
  check(
    "数値キーの指定順",
    JSON.stringify({ 1: "one", 2: "two" }, [2, 1, 2]),
    '{"2":"two","1":"one"}'
  );
  check(
    "ラッパーと通常の値を同じキーとして扱う",
    JSON.stringify({ 1: 1, a: 2 }, [new Number(1), "1", new String("a"), "a"]),
    '{"1":1,"a":2}'
  );
  check("空のキー一覧", JSON.stringify({ a: 1 }, []), "{}");
  var ignored = { a: 1 };
  ignored[true] = 2;
  check("キー以外の要素を無視する", JSON.stringify(ignored, [true, null, {}, "a"]), '{"a":1}');
  check(
    "キー一覧は配列要素を除外しない",
    JSON.stringify([{ a: 1, b: 2 }, 3], ["a"]),
    '[{"a":1},3]'
  );
  check(
    "配列でない置換指定を無視する",
    JSON.stringify({ a: 1 }, { 0: "missing", length: 1 }),
    '{"a":1}'
  );
  check(
    "組み込み名をキーとして指定できる",
    JSON.stringify({ constructor: 1, hasOwnProperty: 2 }, [
      "hasOwnProperty",
      "constructor",
      "constructor"
    ]),
    '{"hasOwnProperty":2,"constructor":1}'
  );
  var conversions = 0;
  var boxed = new String("a");
  boxed.toString = function () {
    conversions++;
    return "a";
  };
  check(
    "キーの変換を再帰の前に一度だけ行う",
    JSON.stringify({ a: { a: 1 } }, [boxed]),
    '{"a":{"a":1}}'
  );
  check("キー変換の回数", conversions, 1);
  var keys = ["a", "b"];
  var changing = {
    a: {
      toJSON: function () {
        keys[1] = "hidden";
        return 1;
      }
    },
    b: 2,
    hidden: 3
  };
  check("処理中の元配列変更に影響されない", JSON.stringify(changing, keys), '{"a":1,"b":2}');
  return { total: total, failures: failures };
})();
