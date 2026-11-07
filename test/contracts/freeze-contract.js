(function () {
  var failures = [],
    total = 0;
  function check(name, value) {
    total++;
    if (!value) failures.push(name);
  }
  var object = { value: 42 };
  check("freeze returns the same object", Object.freeze(object) === object);
  var freeze = Object.freeze;
  check("freeze reference returns the same object", freeze(object) === object);
  check("freeze preserves properties", object.value === 42);
  return { total: total, passed: total - failures.length, failures: failures };
})();
