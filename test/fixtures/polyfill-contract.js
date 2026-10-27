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
  // ECMAScript の WhiteSpace と LineTerminator、および削除されない文字。
  var spaces = [
    0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004,
    0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
  ];
  var retained = [0x85, 0x180e, 0x200b, 0x200c, 0x200d, 0xfffe];
  var i, c;
  for (i = 0; i < spaces.length; i++) {
    c = String.fromCharCode(spaces[i]);
    check("trim leading " + spaces[i], (c + "x").trim(), "x");
    check("trim trailing " + spaces[i], ("x" + c).trim(), "x");
    check("trim interior " + spaces[i], ("x" + c + "y").trim(), "x" + c + "y");
  }
  for (i = 0; i < retained.length; i++) {
    c = String.fromCharCode(retained[i]);
    check("trim retains " + retained[i], (c + "x" + c).trim(), c + "x" + c);
  }
  c = String.fromCharCode(0xd83d, 0xde00);
  check("trim retains surrogate pair", (" " + c + " ").trim(), c);
  check("Number.parseInt repaired hex", Number.parseInt("a?", 16), 10);
  check("Number.parseInt radix", Number.parseInt("101", 2), 5);
  check("Number.parseInt same as global", Number.parseInt === parseInt, true);
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
