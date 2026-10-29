(function () {
  var failures = [];
  var total = 0;
  function check(name, actual, expected) {
    total++;
    if (actual !== expected)
      failures.push(name + ": " + String(actual) + " !== " + String(expected));
  }
  var includes = Array.prototype.includes;
  check("includes number", [1, 2].includes(2), true);
  check("includes absent", [1, 2].includes(3), false);
  check("includes string mismatch", ["a"].includes("b"), false);
  check("includes no coercion", ["1"].includes(1), false);
  check("includes NaN", [NaN].includes(NaN), true);
  check("includes negative zero", [-0].includes(0), true);
  check("includes negative offset", [1, 2, 3].includes(2, -2), true);
  check("includes positive offset", [1, 2, 3].includes(1, 1), false);
  check("includes binary offset", [1, 2, 3].includes(1, "0b10"), false);
  check("includes positive infinity", [1].includes(1, Infinity), false);
  check("includes negative infinity", [1].includes(1, -Infinity), true);
  check("includes array-like", includes.call({ 0: "a", 1: "b", length: "0b10" }, "b"), true);
  check("includes missing index", includes.call({ length: 1 }, undefined), true);
  check("includes string receiver", includes.call("abc", "b"), true);
  var calls = 0;
  var offset = {
    valueOf: function () {
      calls++;
      return 1;
    },
  };
  check("includes coercion result", [0, 1].includes(1, offset), true);
  check("includes coercion once", calls, 1);
  calls = 0;
  check("includes empty", [].includes(1, offset), false);
  check("includes empty no offset coercion", calls, 0);
  var ref = {};
  check("includes object identity", [ref].includes(ref), true);
  check("includes distinct object", [{}].includes({}), false);
  check("padStart default", "x".padStart(3), "  x");
  check("padEnd default", "x".padEnd(3), "x  ");
  check("padStart empty", "x".padStart(3, ""), "x");
  check("padEnd empty", "x".padEnd(3, ""), "x");
  check("padStart repeating", "x".padStart(6, "ab"), "ababax");
  check("padEnd repeating", "x".padEnd(6, "ab"), "xababa");
  check("pad no truncation", "xyz".padStart(2, "0"), "xyz");
  check("pad binary length", "x".padStart("0b11", "0"), "00x");
  check("pad fractional length", "x".padEnd(3.9, "0"), "x00");
  check("pad generic receiver", String.prototype.padStart.call(7, 3, "0"), "007");
  calls = 0;
  var filler = {
    toString: function () {
      calls++;
      return "x";
    },
  };
  check("pad filler unused result", "long".padStart(2, filler), "long");
  check("pad filler unused coercion", calls, 0);
  check("pad filler used result", "a".padEnd(3, filler), "axx");
  check("pad filler coercion once", calls, 1);
  calls = 0;
  var width = {
    valueOf: function () {
      calls++;
      return 3;
    },
  };
  check("pad width conversion", "x".padStart(width, "0"), "00x");
  check("pad width conversion once", calls, 1);
  var whitespace = [
    9, 10, 11, 12, 13, 32, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006,
    0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
  ];
  var nonspaces = [0x85, 0x180e, 0x200b, 0x200c, 0x200d, 0xfffe];
  var i, character;
  for (i = 0; i < whitespace.length; i++) {
    character = String.fromCharCode(whitespace[i]);
    check(
      "trimStart space " + whitespace[i],
      (character + "x" + character).trimStart(),
      "x" + character,
    );
    check(
      "trimEnd space " + whitespace[i],
      (character + "x" + character).trimEnd(),
      character + "x",
    );
  }
  for (i = 0; i < nonspaces.length; i++) {
    character = String.fromCharCode(nonspaces[i]);
    check(
      "trimStart nonspace " + nonspaces[i],
      (character + "x" + character).trimStart(),
      character + "x" + character,
    );
    check(
      "trimEnd nonspace " + nonspaces[i],
      (character + "x" + character).trimEnd(),
      character + "x" + character,
    );
  }
  check("trimLeft alias", String.prototype.trimLeft === String.prototype.trimStart, true);
  check("trimRight alias", String.prototype.trimRight === String.prototype.trimEnd, true);
  check("trimStart generic", String.prototype.trimStart.call(12), "12");
  check("trimEnd generic", String.prototype.trimEnd.call(12), "12");
  return { total: total, passed: total - failures.length, failures: failures };
})();
