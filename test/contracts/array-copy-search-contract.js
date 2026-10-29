(function () {
  var failures = [],
    total = 0;
  function check(name, actual, expected) {
    total++;
    if (actual !== expected)
      failures.push(name + ": " + String(actual) + " !== " + String(expected));
  }
  function assertThrows(name, action, kind) {
    total++;
    try {
      action();
      failures.push(name + ": no exception");
    } catch (e) {
      if (!(e instanceof kind)) failures.push(name + ": " + String(e));
    }
  }
  var a = [3, 1, 2],
    b = a.toSorted();
  check("sort order", b.join(","), "1,2,3");
  check("sort unchanged", a.join(","), "3,1,2");
  check("sort new array", a === b, false);
  check("sort lexicographic", [2, 10, 1].toSorted().join(","), "1,10,2");
  check(
    "sort comparator",
    a
      .toSorted(function (x, y) {
        return y - x;
      })
      .join(","),
    "3,2,1"
  );
  check(
    "sort NaN comparator",
    a
      .toSorted(function () {
        return NaN;
      })
      .join(","),
    "3,1,2"
  );
  check("sort undefined last", [undefined, 2, 1].toSorted().join(","), "1,2,");
  var calls = 0;
  [undefined, undefined].toSorted(function () {
    calls++;
    return 0;
  });
  check("sort skips undefined comparison", calls, 0);
  var stable = [
    { n: 1, id: "a" },
    { n: 0, id: "b" },
    { n: 1, id: "c" },
    { n: 0, id: "d" }
  ].toSorted(function (x, y) {
    return x.n - y.n;
  });
  check("sort stable", stable[0].id + stable[1].id + stable[2].id + stable[3].id, "bdac");
  assertThrows(
    "sort invalid comparator",
    function () {
      a.toSorted(null);
    },
    TypeError
  );
  check("reverse", a.toReversed().join(","), "2,1,3");
  check("reverse unchanged", a.join(","), "3,1,2");
  check("splice insert", a.toSpliced(1, 1, 8, 9).join(","), "3,8,9,2");
  check("splice unchanged", a.join(","), "3,1,2");
  check("splice no args", a.toSpliced().join(","), "3,1,2");
  check("splice start only", a.toSpliced(1).join(","), "3");
  check("splice undefined count", a.toSpliced(1, undefined, 9).join(","), "3,9,1,2");
  check("splice negative", a.toSpliced(-1, 1).join(","), "3,1");
  check("splice infinity", a.toSpliced(Infinity, 1, 9).join(","), "3,1,2,9");
  check("splice minus infinity", a.toSpliced(-Infinity, 1).join(","), "1,2");
  check("splice binary index", a.toSpliced("0b1", 1).join(","), "3,2");
  check("splice negative delete", a.toSpliced(1, -1, 9).join(","), "3,9,1,2");
  var sparse = [1, 2, 3];
  delete sparse[1];
  check("reverse dense", Object.hasOwn(sparse.toReversed(), "1"), true);
  check("sort dense", Object.hasOwn(sparse.toSorted(), "2"), true);
  check("splice dense", Object.hasOwn(sparse.toSpliced(), "1"), true);
  check(
    "reverse generic",
    Array.prototype.toReversed.call({ 0: "a", 1: "b", length: 2 }).join(","),
    "b,a"
  );
  check("sort generic string", Array.prototype.toSorted.call("ba").join(""), "ab");
  check(
    "splice generic",
    Array.prototype.toSpliced.call({ 0: 1, 1: 2, length: 2 }, 1, 1, 9).join(","),
    "1,9"
  );
  check(
    "findLast",
    a.findLast(function (x) {
      return x > 1;
    }),
    2
  );
  check(
    "findLastIndex",
    a.findLastIndex(function (x) {
      return x > 1;
    }),
    2
  );
  check(
    "findLast no match",
    typeof a.findLast(function () {
      return false;
    }),
    "undefined"
  );
  check(
    "findLastIndex no match",
    a.findLastIndex(function () {
      return false;
    }),
    -1
  );
  var visited = [],
    correct = true,
    receiver = { ok: true };
  sparse.findLast(function (x, i, original) {
    visited.push(i);
    correct = correct && this === receiver && original === sparse;
    return false;
  }, receiver);
  check("findLast visits holes", visited.join(","), "2,1,0");
  check("findLast args", correct, true);
  check(
    "findLast hole value",
    sparse.findLastIndex(function (x) {
      return typeof x === "undefined";
    }),
    1
  );
  var changed = [1, 2, 3],
    seen = [];
  changed.findLast(function (x, i) {
    seen.push(String(x));
    if (i === 2) {
      delete changed[1];
      changed.push(4);
    }
    return false;
  });
  check("findLast fixed length and deleted", seen.join(","), "3,undefined,1");
  check(
    "findLast generic",
    Array.prototype.findLast.call("ab", function (x) {
      return x === "a";
    }),
    "a"
  );
  assertThrows(
    "findLast invalid callback",
    function () {
      a.findLast(4);
    },
    TypeError
  );
  assertThrows(
    "findLastIndex invalid callback",
    function () {
      a.findLastIndex(null);
    },
    TypeError
  );
  if (typeof Object.defineProperty === "function") {
    var obj = { length: 2, 1: 2 },
      read = 0;
    Object.defineProperty(obj, "0", {
      get: function () {
        read++;
        throw Error("read removed");
      }
    });
    check("splice skips deleted getter", Array.prototype.toSpliced.call(obj, 0, 1)[0], 2);
    check("skipped getter unread", read, 0);
  }
  return { total: total, passed: total - failures.length, failures: failures };
})();
