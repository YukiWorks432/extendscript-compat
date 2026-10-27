export function run() {
  var nativeConstructor = Number;
  var nativeBinary = nativeConstructor("0b101");
  var nativeParseInt = Number.parseInt;
  var calls = [];
  var failures = [];
  var total = 0;
  function record(value) {
    calls.push(value);
    return value;
  }
  function check(name, actual, expected) {
    total++;
    if (
      !(actual === expected && (actual !== 0 || 1 / actual === 1 / expected)) &&
      !(actual !== actual && expected !== expected)
    ) {
      failures.push({ name: name, actual: String(actual), expected: String(expected) });
    }
  }
  check("binary", Number("0b101"), 5);
  check("octal", Number("0o10"), 8);
  check("non-whitespace", Number(String.fromCharCode(0x200b) + "0"), NaN);
  check("whitespace", Number(String.fromCharCode(0xfeff, 0x1680) + "0b101"), 5);
  check("negative zero", Number("-0"), -0);
  check("no arguments", Number(), 0);
  check("undefined", Number(undefined), NaN);
  check("extra arguments", Number(record("0b101"), record("extra")), 5);
  check("argument order", calls.join(","), "0b101,extra");
  var local = function (Number) {
    return Number("0b101");
  };
  check(
    "local Number",
    local(function (value) {
      return "local:" + value;
    }),
    "local:0b101"
  );
  var object = {
    Number: function (value) {
      return "property:" + value;
    }
  };
  check("property", object.Number("0b101"), "property:0b101");
  check("native alias", nativeConstructor("0b101"), nativeBinary);
  check("native constructor", new Number(7).valueOf(), 7);
  check("native Number retained", Number === nativeConstructor, true);
  check("native Number.parseInt retained", Number.parseInt === nativeParseInt, true);
  return { total: total, passed: total - failures.length, failures: failures };
}
