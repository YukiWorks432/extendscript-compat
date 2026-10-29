function __compatInteger(value) {
  var number = toNumber(value);
  if (number !== number || number === 0) return 0;
  if (number === Infinity || number === -Infinity) return number;
  return (number < 0 ? -1 : 1) * Math.floor(Math.abs(number));
}

function __compatLength(value) {
  var length = __compatInteger(value);
  return length <= 0 ? 0 : Math.min(length, 9007199254740991);
}

function __compatInstall(target, name, implementation) {
  if (typeof Object.defineProperty === "function") {
    try {
      Object.defineProperty(target, name, {
        value: implementation,
        writable: true,
        configurable: true,
        enumerable: false,
      });
      return;
      // oxlint-disable-next-line no-unused-vars -- ES3 requires a catch binding
    } catch (_error) {}
  }
  target[name] = implementation;
}
