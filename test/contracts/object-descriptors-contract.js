(function () {
  var total = 0,
    failures = [];
  function check(name, condition) {
    total++;
    if (!condition) failures.push(name);
  }
  function rejects(name, fn) {
    var rejected = false;
    try {
      fn();
    } catch (error) {
      rejected = error instanceof TypeError;
    }
    check(name, rejected);
  }
  var limited = limitedObjectDescriptors;
  var parent = { inherited: 3 };
  var object = Object.create(parent);
  parent.inherited = 7;
  check("prototype updates remain visible", object.inherited === 7);
  check("inherited data is not own", !Object.prototype.hasOwnProperty.call(object, "inherited"));
  check(
    "inherited descriptor is absent",
    Object.getOwnPropertyDescriptor(object, "inherited") === undefined,
  );
  var functionParent = function () {};
  check(
    "function prototype",
    Object.prototype.isPrototypeOf.call(functionParent, Object.create(functionParent)),
  );
  var dictionary = Object.create(null);
  check(
    "actual null prototype",
    !("toString" in dictionary) &&
      !("constructor" in dictionary) &&
      !Object.prototype.isPrototypeOf.call(Object.prototype, dictionary),
  );
  Object.defineProperty(dictionary, "__proto__", { value: 17 });
  check(
    "dictionary special key is own data",
    Object.prototype.hasOwnProperty.call(dictionary, "__proto__") && dictionary["__proto__"] === 17,
  );
  Object.defineProperty(dictionary, "constructor", { value: 19 });
  check("dictionary constructor key", dictionary.constructor === 19);
  var created = Object.create(parent, { answer: { value: 42 }, toString: { value: "label" } });
  check("create descriptor values", created.answer === 42 && created.toString === "label");
  var returned = Object.defineProperty(object, "answer", {
    value: 42,
    writable: false,
    enumerable: false,
    configurable: false,
  });
  check("define returns target", returned === object);
  var descriptor = Object.getOwnPropertyDescriptor(object, "answer");
  check("descriptor value", descriptor.value === 42);
  check(
    "descriptor attributes match supported behavior",
    descriptor.writable === limited &&
      descriptor.enumerable === limited &&
      descriptor.configurable === limited,
  );
  if (limited) {
    object.answer = 43;
    check("flags do not imply freezing", object.answer === 43);
  }
  var existing = { x: 9 };
  Object.defineProperty(existing, "x", {});
  check("omitted value is preserved", existing.x === 9);
  Object.defineProperty(existing, "x", { value: undefined });
  check(
    "explicit undefined is stored",
    existing.x === undefined && Object.prototype.hasOwnProperty.call(existing, "x"),
  );
  check(
    "own undefined has a descriptor",
    Object.getOwnPropertyDescriptor(existing, "x").value === undefined,
  );
  Object.defineProperty(existing, "newKey", {});
  check(
    "new omitted value creates undefined",
    Object.prototype.hasOwnProperty.call(existing, "newKey") && existing.newKey === undefined,
  );
  check("missing descriptor", Object.getOwnPropertyDescriptor(existing, "absent") === undefined);
  var conversions = 0;
  Object.defineProperty(
    existing,
    {
      toString: function () {
        conversions++;
        return "key";
      },
    },
    { value: 5 },
  );
  check("key conversion once", conversions === 1 && existing.key === 5);
  rejects("invalid prototype number", function () {
    Object.create(1);
  });
  rejects("invalid prototype undefined", function () {
    Object.create(undefined);
  });
  rejects("invalid define target", function () {
    Object.defineProperty(null, "x", {});
  });
  rejects("invalid descriptor", function () {
    Object.defineProperty({}, "x", null);
  });
  rejects("invalid create descriptor", function () {
    Object.create(parent, { x: 3 });
  });
  rejects("mixed descriptor", function () {
    Object.defineProperty({}, "x", {
      value: 1,
      get: function () {
        return 1;
      },
    });
  });
  if (limited) {
    var calls = 0;
    rejects("getter unsupported", function () {
      Object.defineProperty({}, "x", {
        get: function () {
          calls++;
          return 1;
        },
      });
    });
    rejects("setter unsupported", function () {
      Object.defineProperty({}, "x", {
        set: function () {
          calls++;
        },
      });
    });
    rejects("create getter unsupported", function () {
      Object.create(parent, {
        x: {
          get: function () {
            calls++;
            return 1;
          },
        },
      });
    });
    check("accessors are not executed", calls === 0);
    var plain = {};
    rejects("ordinary proto key rejected", function () {
      Object.defineProperty(plain, "__proto__", { value: { changed: 1 } });
    });
    check(
      "proto rejection preserves inheritance",
      Object.prototype.isPrototypeOf.call(Object.prototype, plain) && plain.changed === undefined,
    );
    rejects("built-in attributes unsupported", function () {
      Object.getOwnPropertyDescriptor([], "length");
    });
  }
  return { total: total, passed: total - failures.length, failures: failures };
})();
