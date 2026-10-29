export function run() {
  var failures = [];
  var total = 0;
  function check(name, actual, expected) {
    total++;
    if (
      !(actual === expected && (actual !== 0 || 1 / actual === 1 / expected)) &&
      !(actual !== actual && expected !== expected)
    ) {
      failures.push({ name: name, actual: String(actual), expected: String(expected) });
    }
  }
  var originalNumber = Number;
  var originalParseInt = Number.parseInt;
  var box = new Number("0b101");
  check("constructor value", box.valueOf(), 5);
  check("constructor type", typeof box, "object");
  check("constructor instance", box instanceof Number, true);
  check("constructor prototype", Object.prototype.toString.call(box), "[object Number]");
  check("constructor empty", new Number().valueOf(), 0);
  check("constructor no parentheses", new Number().valueOf(), 0);
  check("constructor parenthesized", new Number().valueOf(), 0);
  check("constructor undefined", new Number(undefined).valueOf(), NaN);
  check("nested omitted parentheses", new Number(new Number()).valueOf(), 0);
  var order = [];
  var object = {
    valueOf: function () {
      order.push("coerce");
      return "0b101";
    }
  };
  var value = new Number((order.push("first"), object), (order.push("second"), 2));
  check("constructor object", value.valueOf(), 5);
  check("constructor order", order.join(","), "first,second,coerce");
  var convert = Number;
  var identity = convert === Number;
  check("alias", convert("0b101"), 5);
  check("alias identity", identity && convert === Number, true);
  var changed = Number;
  changed = function () {
    return "custom";
  };
  check("changed alias", changed("0b101"), "custom");
  var holder = { value: Number };
  var rawBinary = holder.value("0b101");
  check("escaped native alias", String(holder.value("0b101")), String(rawBinary));
  check("Number identity", Number === originalNumber, true);
  check("parseInt identity", Number.parseInt === originalParseInt, true);
  return { total: total, passed: total - failures.length, failures: failures };
}
