import { posix } from "node:path";
import { traverse, types as t } from "@babel/core";

/** @param {import('@babel/core').types.File} program @param {import('rollup').RenderedChunk} chunk @param {Record<string,import('rollup').RenderedChunk>} chunks @param {string} runtimeId */
export function removeRuntimeImports(program, chunk, chunks, runtimeId) {
  const unused = new Set(
    Object.values(chunks)
      .filter((c) => c.moduleIds.length === 1 && c.moduleIds[0] === runtimeId)
      .map((c) => c.fileName),
  );
  /** @param {import('@babel/core').types.Node | null | undefined} node */
  const targetsRuntime = (node) => {
    if (!t.isStringLiteral(node)) return false;
    const file = posix.normalize(posix.join(posix.dirname(chunk.fileName), node.value));
    // AMDの依存名は通常.jsを省略する。
    return unused.has(file) || unused.has(file + ".js");
  };
  traverse(program, {
    CallExpression(path) {
      const { callee, arguments: args } = path.node;
      if (t.isIdentifier(callee, { name: "require" }) && targetsRuntime(args[0])) {
        if (path.parentPath.isVariableDeclarator()) path.parentPath.remove();
        else if (path.parentPath.isExpressionStatement()) path.parentPath.remove();
        else path.replaceWith(t.unaryExpression("void", t.numericLiteral(0)));
        return;
      }
      const registration =
        t.isIdentifier(callee, { name: "define" }) ||
        (t.isMemberExpression(callee) && t.isIdentifier(callee.property, { name: "register" }));
      if (!registration) return;
      const deps = args.find(t.isArrayExpression),
        factory = args.find(t.isFunctionExpression);
      if (!deps || !factory) return;
      for (let index = deps.elements.length - 1; index >= 0; index--) {
        if (!targetsRuntime(deps.elements[index])) continue;
        deps.elements.splice(index, 1);
        if (t.isIdentifier(callee, { name: "define" })) factory.params.splice(index, 1);
        else {
          // System.registerの依存とsetterは同じ添字で対応する。
          traverse(t.file(t.program([t.expressionStatement(factory)])), {
            ObjectProperty(property) {
              if (
                t.isIdentifier(property.node.key, { name: "setters" }) &&
                t.isArrayExpression(property.node.value)
              )
                property.node.value.elements.splice(index, 1);
            },
          });
        }
      }
    },
  });
  chunk.imports = chunk.imports.filter((id) => !unused.has(id));
  for (const id of unused) delete chunk.importedBindings[id];
}

/** @param {import('@babel/core').NodePath} owner @param {import('rollup').RenderedChunk} chunk */
export function removeRuntimeExports(owner, chunk) {
  if (!owner.isFunctionDeclaration() || !owner.node.id) return;
  const binding = owner.scope.getBinding(owner.node.id.name);
  for (const reference of binding?.referencePaths ?? []) {
    const parent = reference.parentPath;
    if (!parent) continue;
    let key;
    if (parent.isAssignmentExpression() && t.isMemberExpression(parent.node.left)) {
      const property = parent.node.left.property;
      key = t.isIdentifier(property)
        ? property.name
        : t.isStringLiteral(property)
          ? property.value
          : undefined;
    } else if (parent.isCallExpression() && t.isStringLiteral(parent.node.arguments[0]))
      key = parent.node.arguments[0].value;
    else continue;
    if (key) chunk.exports = chunk.exports.filter((name) => name !== key);
    if (parent.parentPath.isExpressionStatement()) parent.parentPath.remove();
    else parent.replaceWith(t.unaryExpression("void", t.numericLiteral(0)));
  }
}
