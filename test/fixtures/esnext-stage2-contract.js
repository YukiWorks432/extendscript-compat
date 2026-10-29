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
  var obj = {};
  obj[10] = "ten";
  obj[2] = "two";
  obj["01"] = "leading";
  obj["4294967295"] = "large";
  obj[0] = "zero";
  obj.z = "zee";
  obj.a = "aye";
  var entries = Object.entries(obj);
  check(
    "entries numeric order",
    entries[0][0] + "," + entries[1][0] + "," + entries[2][0],
    "0,2,10"
  );
  check(
    "entries nonindices",
    entries[3][0] + "," + entries[4][0] + "," + entries[5][0] + "," + entries[6][0],
    "01,4294967295,z,a"
  );
  check(
    "entries values",
    entries[0][1] + "," + entries[1][1] + "," + entries[2][1],
    "zero,two,ten"
  );
  check("values numeric order", Object.values(obj).slice(0, 3).join(","), "zero,two,ten");
  var tricky = { propertyIsEnumerable: "value", hasOwnProperty: "own", toString: "text" };
  check("entries shadowed method", Object.entries(tricky).length, 3);
  check("values shadowed method", Object.values(tricky).length, 3);
  function Parent() {}
  Parent.prototype = { inherited: "inherited" };
  var child = new Parent();
  child.own = "own";
  check("entries excludes inherited", Object.entries(child).length, 1);
  check("values excludes inherited", Object.values(child).join(","), "own");
  check("entries string keys", Object.entries("ab")[0][0] + Object.entries("ab")[1][0], "01");
  check("entries string values", Object.entries("ab")[0][1] + Object.entries("ab")[1][1], "ab");
  check("values string", Object.values("ab").join(""), "ab");
  check("entries number", Object.entries(3).length, 0);
  check("values boolean", Object.values(true).length, 0);
  assertThrows("entries null", function () {
    Object.entries(null);
  });
  assertThrows("values undefined", function () {
    Object.values(undefined);
  });
  var array = [1, 2, 3];
  delete array[1];
  var flat = [array, [4, [5]]].flat();
  check("flat skips deleted hole", flat.length, 4);
  check("flat order", flat[0] + "," + flat[1] + "," + flat[2], "1,3,4");
  check("flat depth one", Array.isArray(flat[3]), true);
  check("flat depth two", [1, [2, [3]]].flat(2).join(","), "1,2,3");
  check("flat binary depth", [1, [2, [3]]].flat("0b10").join(","), "1,2,3");
  check("flat depth zero", Array.isArray([1, [2]].flat(0)[1]), true);
  check("flat negative depth", Array.isArray([1, [2]].flat(-1)[1]), true);
  check("flat infinity", [1, [2, [3]]].flat(Infinity).join(","), "1,2,3");
  var explicit = [undefined];
  check("flat preserves undefined", [explicit].flat().length, 1);
  check("flat preserves undefined value", typeof [explicit].flat()[0], "undefined");
  check("flat generic", Array.prototype.flat.call({ 0: [1, 2], length: 1 }).join(","), "1,2");
  var mapped = array.flatMap(function (value) {
    return [value, value * 10];
  });
  check("flatMap skips deleted hole", mapped.join(","), "1,10,3,30");
  var receiver = { factor: 3 },
    calls = [];
  var doubled = [2, 4].flatMap(function (value, index, original) {
    calls.push(index + ":" + original.length);
    return [value * this.factor];
  }, receiver);
  check("flatMap thisArg", doubled.join(","), "6,12");
  check("flatMap callback arguments", calls.join(","), "0:2,1:2");
  check(
    "flatMap depth one",
    Array.isArray(
      [1].flatMap(function () {
        return [[2]];
      })[0]
    ),
    true
  );
  check(
    "flatMap scalar",
    [1, 2]
      .flatMap(function (x) {
        return x + 1;
      })
      .join(","),
    "2,3"
  );
  assertThrows("flatMap callback", function () {
    [1].flatMap(4);
  });
  check("at first", "abc".at(0), "a");
  check("at negative", "abc".at(-1), "c");
  check("at out of range", typeof "abc".at(3), "undefined");
  check("at negative out of range", typeof "abc".at(-4), "undefined");
  check("at binary index", "abc".at("0b10"), "c");
  check("at fractional index", "abc".at(1.9), "b");
  check("at NaN", "abc".at(NaN), "a");
  check("at infinity", typeof "abc".at(Infinity), "undefined");
  check("at generic", String.prototype.at.call(123, -1), "3");
  var pair = String.fromCharCode(0xd83d, 0xde00);
  check("at surrogate first", pair.at(0).charCodeAt(0), 0xd83d);
  check("at surrogate second", pair.at(1).charCodeAt(0), 0xde00);
  check("at surrogate unit", pair.at(0).length, 1);
  var coercions = 0,
    ix = {
      valueOf: function () {
        coercions++;
        return 1;
      }
    };
  check("at conversion", "abc".at(ix), "b");
  check("at conversion once", coercions, 1);
  if (typeof Object.defineProperty === "function") {
    var hidden = { visible: 1 };
    Object.defineProperty(hidden, "hidden", { value: 2, enumerable: false });
    check("entries excludes hidden", Object.entries(hidden).length, 1);
    check("values excludes hidden", Object.values(hidden).length, 1);
    var changing = {};
    Object.defineProperty(changing, "a", {
      enumerable: true,
      get: function () {
        delete changing.b;
        return 1;
      }
    });
    Object.defineProperty(changing, "b", { enumerable: true, configurable: true, value: 2 });
    check("entries honors deleted property", Object.entries(changing).length, 1);
  }
  return { total: total, passed: total - failures.length, failures: failures };
})();
