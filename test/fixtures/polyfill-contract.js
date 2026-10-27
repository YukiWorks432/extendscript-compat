(function () {
  var failures = [];
  var total = 0;
  function check(name, actual, expected) {
    total++;
    if (actual !== expected)
      failures.push({ name: name, actual: String(actual), expected: String(expected) });
  }
  var array = [1, 2, 3];
  delete array[1];
  var calls = 0;
  var mapped = array.map(function (value) {
    calls++;
    return value * 2;
  });
  check("ES5 map values", mapped.join(","), "2,,6");
  check("ES5 map skips holes", calls, 2);
  check(
    "ES5 filter",
    [1, 2, 3]
      .filter(function (value) {
        return value > 1;
      })
      .join(","),
    "2,3",
  );
  check(
    "ES5 reduce",
    [1, 2, 3].reduce(function (a, b) {
      return a + b;
    }, 0),
    6,
  );
  check("ES5 isArray", Array.isArray([]), true);
  check("ES5 keys", Object.keys({ a: 1, b: 2 }).sort().join(","), "a,b");
  check(
    "ES5 bind",
    function (value) {
      return this.base + value;
    }.bind({ base: 4 }, 3)(),
    7,
  );
  check("ES5 trim", "  abc  ".trim(), "abc");
  check(
    "JSON.stringify",
    JSON.stringify({ a: [1, true, null], b: "x" }),
    '{"a":[1,true,null],"b":"x"}',
  );
  check("JSON.parse", JSON.parse('{"a":[1,2]}').a[1], 2);
  check(
    "JSON.parse reviver",
    JSON.parse('{"n":2}', function (key, value) {
      return key === "n" ? value * 2 : value;
    }).n,
    4,
  );
  var rejected = false;
  try {
    JSON.parse('{"a":}');
  } catch (error) {
    rejected = error instanceof SyntaxError;
  }
  check("JSON rejects malformed input", rejected, true);
  check("ES6 Array.from", Array.from({ 0: "x", 1: "y", length: 2 }).join(","), "x,y");
  check("ES6 Array.of", Array.of(1, 2, 3).join(","), "1,2,3");
  check(
    "ES6 find",
    [1, 3, 4].find(function (value) {
      return value % 2 === 0;
    }),
    4,
  );
  check(
    "ES6 findIndex",
    [1, 3, 4].findIndex(function (value) {
      return value % 2 === 0;
    }),
    2,
  );
  check("ES6 startsWith", "abcdef".startsWith("cd", 2), true);
  check("ES6 endsWith", "abcdef".endsWith("cd", 4), true);
  check("ES6 Number.isFinite number", Number.isFinite(1), true);
  check("ES6 Number.isFinite string", Number.isFinite("1"), false);
  check("ES6 Object.assign", Object.assign({ a: 1 }, { b: 2 }).b, 2);
  check("ES6 Math.trunc", Math.trunc(-1.9), -1);
  return { total: total, passed: total - failures.length, failures: failures };
})();
