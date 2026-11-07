import { posix } from "node:path";
import { parse, traverse, types as t } from "@babel/core";

/** @param {import('@babel/core').types.File} program @param {import('rollup').RenderedChunk} chunk @param {Record<string,import('rollup').RenderedChunk>} chunks @param {string} runtimeId @param {import('rollup').NormalizedOutputOptions} options */
export function removeRuntimeImports(program, chunk, chunks, runtimeId, options) {
  const configured = options.format === "amd" ? parse("(" + options.amd.define + ")") : null;
  const amdName =
    configured && t.isExpressionStatement(configured.program.body[0])
      ? referenceName(configured.program.body[0].expression)
      : undefined;
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
      const isAmd = options.format === "amd" && referenceName(callee) === amdName;
      const registration =
        isAmd || (options.format === "system" && referenceName(callee) === "System.register");
      if (!registration) return;
      const deps = args.find(t.isArrayExpression),
        factory = args.find(t.isFunctionExpression);
      if (!deps || !factory) return;
      for (let index = deps.elements.length - 1; index >= 0; index--) {
        if (!targetsRuntime(deps.elements[index])) continue;
        deps.elements.splice(index, 1);
        if (isAmd) factory.params.splice(index, 1);
        else {
          // System.registerの依存とsetterは同じ添字で対応する。
          const returned = factory.body.body.find((statement) => t.isReturnStatement(statement));
          let descriptor = returned?.argument;
          if (t.isSequenceExpression(descriptor)) descriptor = descriptor.expressions.at(-1);
          if (t.isObjectExpression(descriptor)) {
            for (const property of descriptor.properties) {
              if (
                t.isObjectProperty(property) &&
                (t.isIdentifier(property.key, { name: "setters" }) ||
                  t.isStringLiteral(property.key, { value: "setters" })) &&
                t.isArrayExpression(property.value)
              )
                property.value.elements.splice(index, 1);
            }
          }
        }
      }
    },
  });
  chunk.imports = chunk.imports.filter((id) => !unused.has(id));
  for (const id of unused) delete chunk.importedBindings[id];
}

/** @param {import('@babel/core').types.Node} node @returns {string | undefined} */
function referenceName(node) {
  if (t.isIdentifier(node)) return node.name;
  if (!t.isMemberExpression(node)) return undefined;
  const parent = referenceName(node.object);
  const key =
    !node.computed && t.isIdentifier(node.property)
      ? node.property.name
      : t.isStringLiteral(node.property)
        ? node.property.value
        : undefined;
  return parent && key ? parent + "." + key : undefined;
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
