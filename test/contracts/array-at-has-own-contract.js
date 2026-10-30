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
    } catch (error) {
      if (!(error instanceof TypeError)) failures.push(name + ": " + String(error));
    }
  }
  var a = [10, 20, 30];
  check("at first", a.at(0), 10);
  check("at last", a.at(-1), 30);
  check("at negative boundary", a.at(-3), 10);
  check("at out of bounds", typeof a.at(3), "undefined");
  check("at negative out of bounds", typeof a.at(-4), "undefined");
  check("at fractional", a.at(1.9), 20);
  check("at negative fractional", a.at(-1.9), 30);
  check("at NaN", a.at(NaN), 10);
  check("at omitted", a.at(), 10);
  check("at infinity", typeof a.at(Infinity), "undefined");
  check("at negative infinity", typeof a.at(-Infinity), "undefined");
  check("at binary index", a.at("0b10"), 30);
  check("at generic", Array.prototype.at.call({ 0: "a", 1: "b", length: 2 }, -1), "b");
  check("at string", Array.prototype.at.call("abc", 1), "b");
  var sparse = [1, 2];
  delete sparse[1];
  check("at hole", typeof sparse.at(1), "undefined");
  var changes = 0;
  var index = {
    valueOf: function () {
      changes++;
      return 1;
    }
  };
  check("at coerced index", a.at(index), 20);
  check("at coercion once", changes, 1);
  function Parent() {}
  Parent.prototype.inherited = 1;
  var obj = new Parent();
  obj.own = undefined;
  obj.hasOwnProperty = "shadow";
  check("hasOwn own undefined", Object.hasOwn(obj, "own"), true);
  check("hasOwn inherited", Object.hasOwn(obj, "inherited"), false);
  check("hasOwn shadowed", Object.hasOwn(obj, "hasOwnProperty"), true);
  check("hasOwn missing", Object.hasOwn(obj, "missing"), false);
  check("hasOwn primitive index", Object.hasOwn("abc", 1), true);
  check("hasOwn boxed index", Object.hasOwn(Object("abc"), "0"), true);
  check("hasOwn string length", Object.hasOwn("abc", "length"), true);
  check("hasOwn string out of range", Object.hasOwn("abc", "3"), false);
  check("hasOwn string negative", Object.hasOwn("abc", "-1"), false);
  check("hasOwn string leading zero", Object.hasOwn("abc", "01"), false);
  check("hasOwn array length", Object.hasOwn(a, "length"), true);
  check("hasOwn array hole", Object.hasOwn(sparse, "1"), false);
  check("hasOwn array index", Object.hasOwn(a, 0), true);
  check("hasOwn number", Object.hasOwn(4, "x"), false);
  check("hasOwn function length", Object.hasOwn(Parent, "length"), true);
  var count = 0;
  var key = {
    toString: function () {
      count++;
      return "own";
    }
  };
  check("hasOwn key conversion", Object.hasOwn(obj, key), true);
  check("hasOwn key conversion once", count, 1);
  var fallbackKey = {
    toString: function () {
      return {};
    },
    valueOf: function () {
      return "own";
    }
  };
  check("hasOwn valueOf fallback", Object.hasOwn(obj, fallbackKey), true);
  assertThrows("hasOwn invalid key conversion", function () {
    Object.hasOwn(obj, {
      toString: function () {
        return {};
      },
      valueOf: function () {
        return {};
      }
    });
  });
  assertThrows("hasOwn null", function () {
    Object.hasOwn(null, "x");
  });
  assertThrows("hasOwn undefined", function () {
    Object.hasOwn(undefined, "x");
  });
  if (typeof Object.defineProperty === "function") {
    var hidden = {};
    Object.defineProperty(hidden, "x", { value: 1 });
    check("hasOwn nonenumerable", Object.hasOwn(hidden, "x"), true);
  }
  if (typeof Symbol === "function") {
    var sym = Symbol("x"),
      withSymbol = {};
    withSymbol[sym] = 1;
    check("hasOwn symbol", Object.hasOwn(withSymbol, sym), true);
    check(
      "hasOwn symbol from ordinary conversion",
      Object.hasOwn(withSymbol, {
        toString: function () {
          return sym;
        }
      }),
      true
    );
    check(
      "hasOwn symbol from valueOf",
      Object.hasOwn(withSymbol, {
        toString: function () {
          return {};
        },
        valueOf: function () {
          return sym;
        }
      }),
      true
    );
  }
  return { total: total, passed: total - failures.length, failures: failures };
})();
