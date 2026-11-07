import { parse, traverse, transformFromAstSync, types as t } from "@babel/core";
import { prototypeMethods, staticMethods } from "./ponyfill-definitions.js";

export const ponyfillImport = "virtual:extendscript-compat/ponyfill";
const instanceNames = new Set(Object.values(prototypeMethods).flat());

/** @param {import("@babel/core").types.MemberExpression} node */
function propertyName(node) {
  return node.computed
    ? t.isStringLiteral(node.property)
      ? node.property.value
      : undefined
    : t.isIdentifier(node.property)
      ? node.property.name
      : undefined;
}

/** @typedef {{prepare: (path: import('@babel/core').NodePath<import('@babel/core').types.Program>) => import('@babel/core').types.Expression, skip: (path: import('@babel/core').NodePath) => boolean, assertScope: (path: import('@babel/core').NodePath) => void, finish: (program: import('@babel/core').types.File, changed: boolean) => boolean | void}} OutputHooks */
/** @param {OutputHooks} hooks
 * @param {string} code @param {string} id @param {import("@babel/core").TransformOptions["inputSourceMap"]} inputSourceMap */
export function transformPonyfills(code, id, inputSourceMap, hooks) {
  const program = parse(code, { babelrc: false, configFile: false, sourceType: "module" });
  if (!program) throw new Error("Ponyfill conversion received an empty AST");
  let changed = false;
  /** @type {import("@babel/core").types.Expression | undefined} */
  let helper;
  traverse(program, {
    Program(path) {
      helper = hooks.prepare(path);
    },
    ReferencedIdentifier(path) {
      if (hooks.skip(path)) return;
      if (path.node.name !== "parseInt" || path.scope.getBinding("parseInt")) return;
      hooks.assertScope(path);
      if (!helper) throw new Error("Ponyfill namespace was not initialized");
      path.replaceWith(
        t.callExpression(t.memberExpression(t.cloneNode(helper), t.identifier("getParseInt")), []),
      );
      path.skip();
      changed = true;
    },
    MemberExpression: {
      exit(path) {
        if (hooks.skip(path)) return;
        const key = propertyName(path.node);
        if (!key || !helper || !path.isReferenced()) return;
        if (
          path.parentPath.isUpdateExpression() ||
          path.parentPath.isUnaryExpression({ operator: "delete" })
        )
          return;
        const object = path.node.object;
        let group;
        let kind;
        if (
          t.isIdentifier(object) &&
          Object.hasOwn(staticMethods, object.name) &&
          !path.scope.getBinding(object.name) &&
          staticMethods[/** @type {keyof typeof staticMethods} */ (object.name)].includes(key)
        ) {
          group = object.name;
          kind = "getStatic";
        } else if (
          t.isMemberExpression(object) &&
          propertyName(object) === "prototype" &&
          t.isIdentifier(object.object) &&
          Object.hasOwn(prototypeMethods, object.object.name) &&
          !path.scope.getBinding(object.object.name) &&
          prototypeMethods[
            /** @type {keyof typeof prototypeMethods} */ (object.object.name)
          ].includes(key)
        ) {
          group = object.object.name;
          kind = "getPrototypeMethod";
        }
        if (!kind && !instanceNames.has(key)) return;
        if (t.isSuper(object)) return;
        // 直接呼び出しは、Rollupが追加する呼び出しと同じ最終出力の補正へ委ねる。
        if (
          group === "Object" &&
          key === "freeze" &&
          path.parentPath.isCallExpression() &&
          path.parentPath.node.callee === path.node
        )
          return;
        hooks.assertScope(path);
        changed = true;
        const namespace = t.cloneNode(helper);
        if (kind && group) {
          const lookup = t.callExpression(t.memberExpression(namespace, t.identifier(kind)), [
            t.stringLiteral(group),
            t.stringLiteral(key),
          ]);
          const parent = path.parentPath;
          if (
            kind === "getPrototypeMethod" &&
            parent.isCallExpression() &&
            parent.node.callee === path.node
          ) {
            parent.replaceWith(
              t.callExpression(
                t.memberExpression(t.cloneNode(helper), t.identifier("callMethod")),
                [object, lookup, ...parent.node.arguments],
              ),
            );
            parent.skip();
          } else path.replaceWith(lookup);
          path.skip();
          return;
        }
        const parent = path.parentPath;
        if (parent.isCallExpression() && parent.node.callee === path.node) {
          // 単純な変数でも、メソッドのgetterが束縛を変更しうるため一度退避する。
          const receiver = path.scope.generateDeclaredUidIdentifier("receiver");
          const lookup = t.callExpression(
            t.memberExpression(t.cloneNode(helper), t.identifier("getMethod")),
            [t.cloneNode(receiver), t.stringLiteral(key)],
          );
          parent.replaceWith(
            t.callExpression(t.memberExpression(namespace, t.identifier("callMethod")), [
              t.assignmentExpression("=", t.cloneNode(receiver), object),
              lookup,
              ...parent.node.arguments,
            ]),
          );
          parent.skip();
        } else {
          path.replaceWith(
            t.callExpression(t.memberExpression(namespace, t.identifier("getMethod")), [
              object,
              t.stringLiteral(key),
            ]),
          );
          path.skip();
        }
      },
    },
  });
  if (hooks.finish(program, changed) === false) return null;
  const result = transformFromAstSync(program, code, {
    babelrc: false,
    configFile: false,
    sourceMaps: true,
    compact: true,
    sourceFileName: id,
    cloneInputAst: false,
    inputSourceMap,
  });
  if (!result?.code) throw new Error("Ponyfill conversion produced no code");
  return { code: result.code, map: result.map };
}
