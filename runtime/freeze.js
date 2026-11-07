/** 内部用。凍結できないホストでは値を返すだけで、属性を変更しない。
 * @param {{ freeze?: Function }} object */
export function getFreeze(object) {
  var method = object.freeze;
  if (typeof method === "function")
    return function () {
      return /** @type {Function} */ (function () {}.apply).call(method, object, arguments);
    };
  return function (/** @type {unknown} */ value) {
    return value;
  };
}
