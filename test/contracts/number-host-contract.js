import { toNumber } from "../../runtime/number.js";

export function run() {
  var beforeNumber = Number;
  var beforeParseInt = Number.parseInt;
  /** @type {[string, unknown, number][]} */
  var cases = [
    ["binary", "0b101", 5],
    ["binary uppercase", "0B11", 3],
    ["octal", "0o10", 8],
    ["invalid binary", "0b2", NaN],
    ["invalid octal", "0o8", NaN],
    ["signed binary", "-0b1", NaN],
    ["non whitespace", String.fromCharCode(0x200b) + "0", NaN],
    [
      "modern whitespace",
      String.fromCharCode(0x1680, 0xfeff) + "0b101" + String.fromCharCode(0x2029),
      5
    ],
    ["empty", "", 0],
    ["whitespace", " \t\n", 0],
    ["negative zero", "-0", -0],
    ["undefined", undefined, NaN],
    ["null", null, 0],
    ["boolean", true, 1],
    ["hex", "0x10", 16],
    ["signed hex", "+0x10", NaN],
    ["exponent", ".5e2", 50],
    ["invalid suffix", "12x", NaN],
    ["infinity", "-Infinity", -Infinity]
  ];
  var failures = [];
  /** @param {string} name @param {number} actual @param {number} expected */
  function check(name, actual, expected) {
    if (
      !(actual === expected && (actual !== 0 || 1 / actual === 1 / expected)) &&
      !(actual !== actual && expected !== expected)
    ) {
      failures.push({ name: name, actual: String(actual), expected: String(expected) });
    }
  }
  for (var i = 0; i < cases.length; i++) check(cases[i][0], toNumber(cases[i][1]), cases[i][2]);
  check("no arguments", toNumber(), 0);
  /** @type {string[]} */
  var calls = [];
  var value = {
    valueOf: function () {
      calls.push("valueOf");
      return {};
    },
    toString: function () {
      calls.push("toString");
      return "0b101";
    }
  };
  check("object result", toNumber(value), 5);
  if (calls.join(",") !== "valueOf,toString")
    failures.push({ name: "conversion order", actual: calls.join(",") });
  if (Number !== beforeNumber || Number.parseInt !== beforeParseInt)
    failures.push({ name: "global mutation" });
  return {
    total: cases.length + 4,
    passed: cases.length + 4 - failures.length,
    failures: failures
  };
}
