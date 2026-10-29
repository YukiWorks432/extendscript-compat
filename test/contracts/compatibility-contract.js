// oxlint-disable-next-line no-unused-expressions -- 生成器が関数式として読み取る実機用の検証資料。
(function (subtractUnitValues, isNull) {
  var failures = [];
  var total = 0;
  function check(name, run, expected) {
    total++;
    try {
      var actual = run();
      var equal = actual === expected;
      if (actual !== actual && expected !== expected) equal = true;
      if (!equal) failures.push({ name: name, expected: String(expected), actual: String(actual) });
    } catch (error) {
      failures.push({ name: name, error: String(error) });
    }
  }
  check(
    "EC-03: labeled continue",
    function () {
      var values = [];
      outer: for (var i = 0; i < 3; i++) {
        switch (i) {
          case 1:
            continue outer;
          case 2:
            continue outer;
        }
        values.push(i);
      }
      return values.join(",");
    },
    "0",
  );
  check(
    "EC-03: labeled continue preserves finally",
    function () {
      var values = [];
      outer: for (var i = 0; i < 3; i++) {
        try {
          switch (i) {
            case 1:
              continue outer;
          }
          values.push("body" + i);
        } finally {
          values.push("finally" + i);
        }
      }
      return values.join(",");
    },
    "body0,finally0,finally1,body2,finally2",
  );
  check(
    "EC-06: hex dash is literal",
    function () {
      return /[a\x2Dz]/.test("b");
    },
    false,
  );
  check(
    "EC-06: unicode dash is literal",
    function () {
      return /[a\u002Dz]/.test("b");
    },
    false,
  );
  check(
    "EC-06: literal dash matches",
    function () {
      return /[a\x2Dz]/.test("-");
    },
    true,
  );
  check(
    "EC-06: neighbors match",
    function () {
      return /[a\x2Dz]/.test("a") && /[a\x2Dz]/.test("z");
    },
    true,
  );
  check(
    "EC-06: negated class",
    function () {
      return /[^a\u002Dz]/.test("b");
    },
    true,
  );
  check(
    "EC-06: negated dash",
    function () {
      return /[^a\u002Dz]/.test("-");
    },
    false,
  );
  check(
    "EC-06: range endpoint",
    function () {
      return /[\x2D-a]/.test("0");
    },
    true,
  );
  check(
    "EC-06: adjacent range",
    function () {
      return /[+\x2D-z]/.test("b");
    },
    true,
  );
  check(
    "EC-06: equal range endpoints",
    function () {
      return /[\x2D-\u002D]/.test("-");
    },
    true,
  );
  check(
    "EC-06: escaped closing bracket",
    function () {
      return /[a\]b\x2Dz]/.test("m");
    },
    false,
  );
  check(
    "EC-06: outside class",
    function () {
      return /\x2D/.test("-");
    },
    true,
  );
  check(
    "EC-06: escaped backslash",
    function () {
      return /[\\x2D]/.test("-");
    },
    false,
  );
  check(
    "EC-10: numeric subtraction",
    function () {
      return subtractUnitValues(10, 2);
    },
    8,
  );
  check(
    "EC-10: number minus unit",
    function () {
      return subtractUnitValues(10, new UnitValue("2 in")).value;
    },
    8,
  );
  check(
    "EC-10: negative left",
    function () {
      return subtractUnitValues(-3, new UnitValue("2 cm")).value;
    },
    -5,
  );
  check(
    "EC-10: negative right",
    function () {
      return subtractUnitValues(3, new UnitValue("-2 cm")).value;
    },
    5,
  );
  check(
    "EC-10: result unit",
    function () {
      return subtractUnitValues(10, new UnitValue("2 in")).type;
    },
    "in",
  );
  check(
    "EC-10: native result type",
    function () {
      return subtractUnitValues(10, new UnitValue("2 in")) instanceof UnitValue;
    },
    true,
  );
  check(
    "EC-10: input unchanged",
    function () {
      var input = new UnitValue("2 in");
      subtractUnitValues(10, input);
      return input.value;
    },
    2,
  );
  check(
    "EC-10: forward native subtraction",
    function () {
      return subtractUnitValues(new UnitValue("2 in"), 10).value;
    },
    -8,
  );
  check(
    "EC-10: native mixed units",
    function () {
      var result = subtractUnitValues(new UnitValue("1 in"), new UnitValue("12.7 mm"));
      return Math.abs(result.value - 0.5) < 1e-12 && result.type === "in";
    },
    true,
  );
  check(
    "EC-10: pixel conversion base",
    function () {
      var input = new UnitValue("20 px");
      input.baseUnit = new UnitValue(1 / 96, "in");
      var result = subtractUnitValues(10, input);
      return Math.abs(result.as("in") + 10 / 96) < 1e-12 && input.value === 20;
    },
    true,
  );
  check(
    "EC-10: percentage conversion base",
    function () {
      var input = new UnitValue("25 %");
      input.baseUnit = new UnitValue("200 cm");
      var result = subtractUnitValues(100, input);
      return result.value === 75 && Math.abs(result.as("cm") - 150) < 1e-12;
    },
    true,
  );
  check(
    "EC-10: negative zero",
    function () {
      return 1 / subtractUnitValues(-0, new UnitValue(0, "pt")).value < 0;
    },
    true,
  );
  check(
    "EC-10: positive zero",
    function () {
      return 1 / subtractUnitValues(0, new UnitValue(0, "pt")).value > 0;
    },
    true,
  );
  check(
    "EC-10: reject string input",
    function () {
      try {
        subtractUnitValues("10", new UnitValue("2 in"));
      } catch (error) {
        return error instanceof TypeError;
      }
      return false;
    },
    true,
  );
  check(
    "EC-11: positive fraction",
    function () {
      return isNull(new UnitValue("0.5 in"));
    },
    false,
  );
  check(
    "EC-11: negative fraction",
    function () {
      return isNull(new UnitValue("-0.5 in"));
    },
    false,
  );
  check(
    "EC-11: zero unit",
    function () {
      return isNull(new UnitValue("0 in"));
    },
    false,
  );
  check(
    "EC-11: other magnitude",
    function () {
      return isNull(new UnitValue("2 in"));
    },
    false,
  );
  check(
    "EC-11: actual null",
    function () {
      return isNull(null);
    },
    true,
  );
  check(
    "EC-11: undefined",
    function () {
      return isNull(void 0);
    },
    false,
  );
  check(
    "EC-11: number",
    function () {
      return isNull(0);
    },
    false,
  );
  check(
    "EC-11: ordinary object",
    function () {
      return isNull({});
    },
    false,
  );
  return { total: total, passed: total - failures.length, failures: failures };
});
