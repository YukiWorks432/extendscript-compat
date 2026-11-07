// 属性を再現できないホストでは、通常のデータプロパティだけを扱う。
var __compatNativeDefine = Object.defineProperty;
var __compatNativeDescriptor = Object.getOwnPropertyDescriptor;
var __compatLookupGetter = Object.prototype.__lookupGetter__;
var __compatLookupSetter = Object.prototype.__lookupSetter__;
var __compatDescriptorsSupported = false;
var __compatAccessorsSupported = false;
var __compatDescriptorReadSupported = false;
if (typeof __compatNativeDescriptor === "function") {
  try {
    var __compatReadProbe = __compatNativeDescriptor([], "length");
    __compatDescriptorReadSupported =
      __compatReadProbe.value === 0 &&
      __compatReadProbe.writable === true &&
      __compatReadProbe.enumerable === false &&
      __compatReadProbe.configurable === false;
  }
  // oxlint-disable-next-line no-unused-vars -- ES3ではcatch変数が必須。
  catch (__compatReadError) {}
}
if (typeof __compatNativeDefine === "function") {
  try {
    var __compatDescriptorProbe = {};
    __compatNativeDefine(__compatDescriptorProbe, "x", {
      get: function () {
        return 7;
      },
      configurable: true,
    });
    __compatAccessorsSupported = __compatDescriptorProbe.x === 7;
    __compatDescriptorsSupported =
      __compatAccessorsSupported &&
      __compatDescriptorReadSupported &&
      typeof __compatNativeDescriptor(__compatDescriptorProbe, "x").get === "function";
  }
  // oxlint-disable-next-line no-unused-vars -- ES3ではcatch変数が必須。
  catch (__compatDescriptorError) {}
}

function __compatDescriptorRecord(attributes, accessors) {
  if (attributes === null || (typeof attributes !== "object" && typeof attributes !== "function"))
    throw new TypeError("Property descriptor must be an object");
  var record = {},
    name,
    method;
  var flags = ["enumerable", "configurable", "value", "writable", "get", "set"];
  for (var i = 0; i < flags.length; i++) {
    name = flags[i];
    if (!(name in attributes)) continue;
    method = attributes[name];
    if (name === "get" || name === "set") {
      if (!accessors) throw new TypeError("Accessor properties are not supported by this host");
      if (typeof method !== "undefined" && typeof method !== "function")
        throw new TypeError("Invalid accessor");
    }
    record[name] =
      name === "enumerable" || name === "configurable" || name === "writable" ? !!method : method;
  }
  if (
    (Object.prototype.hasOwnProperty.call(record, "get") ||
      Object.prototype.hasOwnProperty.call(record, "set")) &&
    (Object.prototype.hasOwnProperty.call(record, "value") ||
      Object.prototype.hasOwnProperty.call(record, "writable"))
  )
    throw new TypeError("Invalid mixed property descriptor");
  return record;
}

function __compatDefineData(object, key, record) {
  var own = Object.prototype.hasOwnProperty;
  if (
    (typeof __compatLookupGetter === "function" && __compatLookupGetter.call(object, key)) ||
    (typeof __compatLookupSetter === "function" && __compatLookupSetter.call(object, key))
  )
    throw new TypeError("Accessor properties are not supported by this host");
  if (typeof __compatNativeDescriptor === "function") {
    var current = object;
    do {
      var existing = __compatNativeDescriptor(current, key);
      if (existing) {
        if (own.call(existing, "get") || own.call(existing, "set"))
          throw new TypeError("Accessor properties are not supported by this host");
        break;
      }
      current = typeof Object.getPrototypeOf === "function" ? Object.getPrototypeOf(current) : null;
    } while (current !== null);
  }
  // 継承の変更を、データプロパティの作成として成功扱いにしない。
  if (
    key === "__proto__" &&
    !own.call(object, key) &&
    (key in object || Object.prototype.isPrototypeOf.call(Object.prototype, object))
  )
    throw new TypeError("Cannot define __proto__ as data on this object");
  if (!own.call(record, "value") && own.call(object, key)) return object;
  var value = own.call(record, "value") ? record.value : undefined;
  object[key] = value;
  var actual = object[key];
  if (
    !own.call(object, key) ||
    (actual === value
      ? actual === 0 && 1 / actual !== 1 / value
      : !(actual !== actual && value !== value))
  )
    throw new TypeError("Host did not assign the property value");
  return object;
}

function __compatDefineProperty(object, property, attributes) {
  if (object === null || (typeof object !== "object" && typeof object !== "function"))
    throw new TypeError("Property target must be an object");
  var key = __compatPropertyKey(property);
  return __compatDefineData(object, key, __compatDescriptorRecord(attributes, false));
}

function __compatGetOwnPropertyDescriptor(object, property) {
  if (object === null || (typeof object !== "object" && typeof object !== "function"))
    throw new TypeError("Descriptor target must be an object");
  var key = __compatPropertyKey(property);
  if (
    (typeof object === "function" && (key === "length" || key === "name" || key === "prototype")) ||
    (Array.isArray(object) && key === "length")
  )
    throw new TypeError("Built-in property attributes are not supported by this host");
  if (!Object.prototype.hasOwnProperty.call(object, key)) return undefined;
  if (
    (typeof __compatLookupGetter === "function" && __compatLookupGetter.call(object, key)) ||
    (typeof __compatLookupSetter === "function" && __compatLookupSetter.call(object, key))
  )
    throw new TypeError("Accessor descriptors are not supported by this host");
  return {
    value: object[key],
    writable: true,
    enumerable: Object.prototype.propertyIsEnumerable.call(object, key),
    configurable: true,
  };
}

function __compatCreate(prototype, properties) {
  if (prototype !== null && typeof prototype !== "object" && typeof prototype !== "function")
    throw new TypeError("Object prototype must be an object or null");
  var object;
  if (prototype === null) {
    object = {};
    object["__proto__"] = null;
    if (
      Object.prototype.isPrototypeOf.call(Object.prototype, object) ||
      Object.prototype.hasOwnProperty.call(object, "__proto__")
    )
      throw new TypeError("Null prototypes are not supported by this host");
  } else {
    var Temporary = function () {};
    Temporary.prototype = prototype;
    object = new Temporary();
  }
  if (typeof properties !== "undefined") {
    if (properties === null) throw new TypeError("Property descriptors require a value");
    var descriptors = Object(properties),
      keys =
        typeof Object.getOwnPropertyNames === "function"
          ? Object.getOwnPropertyNames(descriptors)
          : Object.keys(descriptors),
      records = [],
      i,
      key;
    if (typeof Object.getOwnPropertySymbols === "function") {
      var symbols = Object.getOwnPropertySymbols(descriptors);
      for (i = 0; i < symbols.length; i++) keys.push(symbols[i]);
    }
    // 全記述子を先に変換し、後続の不正記述子で部分的に定義しない。
    for (i = 0; i < keys.length; i++) {
      key = keys[i];
      if (Object.prototype.propertyIsEnumerable.call(descriptors, key))
        records.push([key, __compatDescriptorRecord(descriptors[key], __compatAccessorsSupported)]);
    }
    for (i = 0; i < records.length; i++) {
      key = records[i][0];
      if (typeof __compatNativeDefine === "function")
        __compatNativeDefine(object, key, records[i][1]);
      else __compatDefineData(object, key, records[i][1]);
    }
  }
  return object;
}
