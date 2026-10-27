import { parse, traverse } from "@babel/core";
import MagicString from "magic-string";

export const numberPonyfillImport = "virtual:extendscript-compat/number";

/** @param {string} code @param {string} id */
export function transformNumberCalls(code, id) {
  if (!/\bNumber\b|\\u/.test(code)) return null;
  const program = parse(code, {
    babelrc: false,
    configFile: false,
    sourceType: "module",
    parserOpts: { tokens: true },
  });
  if (!program) throw new Error("Number conversion pass received an empty AST");
  /** @type {Set<string>} */
  const names = new Set();
  /** @type {{start: number, end: number}[]} */
  const calls = [];
  /** @type {{start: number, end: number, hasParens: boolean}[]} */
  const constructors = [];
  /** @type {{line: number, column: number}[]} */
  const diagnostics = [];
  /** @type {Map<object, boolean>} */
  const aliasCache = new Map();
  let hasDirectEval = false;
  traverse(program, {
    Identifier({ node }) {
      names.add(node.name);
    },
    CallExpression(path) {
      if (path.get("callee").isIdentifier({ name: "eval" }) && !path.scope.getBinding("eval"))
        hasDirectEval = true;
    },
  });

  /** @param {import("@babel/core").NodePath} reference */
  function safeAlias(reference) {
    if (hasDirectEval || !reference.isIdentifier()) return false;
    const binding = reference.scope.getBinding(reference.node.name);
    if (!binding || !binding.path.isVariableDeclarator() || !binding.constant) return false;
    if (aliasCache.has(binding)) return aliasCache.get(binding) === true;
    const declarator = binding.path;
    const init = declarator.get("init");
    const declaration = declarator.parentPath;
    const container = declaration.parentPath;
    if (!container) return false;
    const valid =
      init.isIdentifier({ name: "Number" }) &&
      !init.scope.getBinding("Number") &&
      declaration.isVariableDeclaration() &&
      (container.isBlockStatement() || container.isProgram()) &&
      binding.referencePaths.every((ref) => {
        const parent = ref.parentPath;
        if (!parent) return false;
        if (
          parent.isBinaryExpression() &&
          (parent.node.operator === "===" || parent.node.operator === "!==")
        ) {
          const other = parent.node.left === ref.node ? parent.get("right") : parent.get("left");
          return other.isIdentifier({ name: "Number" }) && !other.scope.getBinding("Number");
        }
        if (!parent.isCallExpression() || parent.node.callee !== ref.node) return false;
        let current = ref;
        while (current.parentPath && current.parentPath !== container) {
          if (current.isFunction()) return false;
          current = current.parentPath;
        }
        return (
          !current.isFunction() &&
          current.parentPath === container &&
          current.node.start != null &&
          declaration.node.end != null &&
          current.node.start >= declaration.node.end
        );
      });
    aliasCache.set(binding, valid);
    return valid;
  }

  traverse(program, {
    ReferencedIdentifier(path) {
      if (path.node.name !== "Number" || path.scope.getBinding("Number")) return;
      const parent = path.parentPath;
      if (parent.isCallExpression() && parent.node.callee === path.node) return;
      if (parent.isNewExpression() && parent.node.callee === path.node) return;
      if (parent.isUnaryExpression({ operator: "typeof" })) return;
      if (
        parent.isBinaryExpression() &&
        (parent.node.operator === "===" ||
          parent.node.operator === "!==" ||
          (parent.node.operator === "instanceof" && parent.node.right === path.node))
      )
        return;
      if (parent.isVariableDeclarator() && parent.node.init === path.node) {
        const variable = parent.get("id");
        if (variable.isIdentifier() && safeAlias(variable)) return;
      }
      if (parent.isMemberExpression() && parent.node.object === path.node) {
        const member = parent.node;
        if (
          !member.computed &&
          member.property.type === "Identifier" &&
          member.property.name !== "call" &&
          member.property.name !== "apply" &&
          member.property.name !== "bind"
        )
          return;
      }
      if (!path.node.loc) throw new Error("Number conversion pass found no source location");
      diagnostics.push({ line: path.node.loc.start.line, column: path.node.loc.start.column });
    },
    CallExpression(path) {
      const callee = path.get("callee");
      if (!callee.isIdentifier()) return;
      const direct = callee.node.name === "Number" && !callee.scope.getBinding("Number");
      if (!direct && !safeAlias(callee)) return;
      if (callee.node.start == null || callee.node.end == null)
        throw new Error("Number conversion pass found no source position");
      calls.push({ start: callee.node.start, end: callee.node.end });
    },
    NewExpression(path) {
      const callee = path.get("callee");
      if (!callee.isIdentifier({ name: "Number" }) || callee.scope.getBinding("Number")) return;
      if (callee.node.end == null || path.node.end == null)
        throw new Error("Number conversion pass found no source position");
      const args = path.get("arguments");
      if (args.length === 1 && args[0].isCallExpression()) {
        const inner = args[0].get("callee");
        if (inner.isIdentifier()) {
          const binding = inner.scope.getBinding(inner.node.name);
          if (
            binding &&
            binding.path.isImportSpecifier() &&
            binding.path.node.imported.type === "Identifier" &&
            binding.path.node.imported.name === "toNumber" &&
            binding.path.parentPath.isImportDeclaration() &&
            binding.path.parentPath.node.source.value === numberPonyfillImport
          )
            return;
        }
      }
      const calleeEnd = callee.node.end;
      const expressionEnd = path.node.end;
      const opening = (program.tokens || []).find(
        (token) =>
          token.start >= calleeEnd && token.end <= expressionEnd && token.type.label === "(",
      );
      constructors.push({
        start: opening ? opening.end : expressionEnd,
        end: expressionEnd,
        hasParens: Boolean(opening),
      });
    },
  });
  if (calls.length === 0 && constructors.length === 0)
    return diagnostics.length ? { diagnostics } : null;
  let alias = "__extendscriptCompatToNumber";
  for (let index = 0; names.has(alias); index++) alias = "__extendscriptCompatToNumber" + index;
  const transformed = new MagicString(code);
  for (const call of calls) transformed.overwrite(call.start, call.end, alias);
  // 入れ子の末尾が同じ位置に重なる場合は、内側の挿入を先に行う。
  for (const item of constructors.toReversed()) {
    if (item.hasParens) {
      transformed.appendLeft(item.start, alias + "(");
      transformed.appendLeft(item.end - 1, ")");
    } else {
      transformed.appendLeft(item.end, "(" + alias + "())");
    }
  }
  const interpreter = program.program.interpreter;
  const insertion = interpreter?.end ?? (code.charCodeAt(0) === 0xfeff ? 1 : 0);
  const leadingNewline = interpreter ? "\n" : "";
  transformed.appendLeft(
    insertion,
    leadingNewline + `import { toNumber as ${alias} } from "${numberPonyfillImport}";\n`,
  );
  return {
    diagnostics,
    code: transformed.toString(),
    map: transformed.generateMap({ source: id, includeContent: true, hires: true }),
  };
}
