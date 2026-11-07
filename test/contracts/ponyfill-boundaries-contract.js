(function () {
  var failures = [],
    total = 0;
  function check(name, actual, expected) {
    total++;
    if (actual !== expected)
      failures.push(name + ": " + String(actual) + " !== " + String(expected));
  }
  check("prototype slice receiver", Array.prototype.slice().length, 0);
  check("prototype trim receiver", String.prototype.trim(), "");
  check("prototype bracket receiver", String["prototype"]["trim"](), "");
  check(
    "prototype map receiver",
    Array.prototype.map(function (value) {
      return value;
    }).length,
    0,
  );
  var trim = String.prototype.trim;
  check("borrowed trim receiver", trim.call(" x "), "x");
  check("ordinary trim receiver", " y ".trim(), "y");
  var invalid = new Date(NaN);
  check("invalid date toString", invalid.toString(), "Invalid Date");
  check("invalid date toUTCString", invalid.toUTCString(), "Invalid Date");
  check("invalid date toDateString", invalid.toDateString(), "Invalid Date");
  var stringify = Date.prototype.toString;
  check("borrowed invalid date", stringify.call(invalid), "Invalid Date");
  check("valid UTC date", new Date(0).toUTCString(), "Thu, 01 Jan 1970 00:00:00 GMT");
  check("zero omitted precision", (0).toExponential(), "0e+0");
  check("zero zero precision", (0).toExponential(0), "0e+0");
  check("zero two digits", (0).toExponential(2), "0.00e+0");
  check("negative zero digits", (-0).toExponential(2), "0.00e+0");
  check("zero maximum ES5 digits", (0).toExponential(20), "0.00000000000000000000e+0");
  check("nonzero digits", (12.5).toExponential(2), "1.25e+1");
  var calls = 0;
  check(
    "coerced digits",
    (0).toExponential({
      valueOf: function () {
        calls++;
        return 2.9;
      },
    }),
    "0.00e+0",
  );
  check("digits coerced once", calls, 1);
  return { total: total, passed: total - failures.length, failures: failures };
})();
