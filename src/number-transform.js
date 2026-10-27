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
  });
  if (!program) throw new Error("Number conversion pass received an empty AST");
  /** @type {Set<string>} */
  const names = new Set();
  /** @type {{start: number, end: number}[]} */
  const calls = [];
  /** @type {{line: number, column: number}[]} */
  const diagnostics = [];
  traverse(program, {
    Identifier({ node }) {
      names.add(node.name);
    },
    ReferencedIdentifier(path) {
      if (path.node.name !== "Number" || path.scope.getBinding("Number")) return;
      const parent = path.parentPath;
      if (parent.isCallExpression() && parent.node.callee === path.node) return;
      if (parent.isUnaryExpression({ operator: "typeof" })) return;
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
      const callee = path.node.callee;
      if (
        callee.type !== "Identifier" ||
        callee.name !== "Number" ||
        path.scope.getBinding("Number")
      )
        return;
      if (callee.start == null || callee.end == null)
        throw new Error("Number conversion pass found no source position");
      calls.push({ start: callee.start, end: callee.end });
    },
  });
  if (calls.length === 0) return diagnostics.length ? { diagnostics } : null;
  let alias = "__extendscriptCompatToNumber";
  for (let index = 0; names.has(alias); index++) alias = "__extendscriptCompatToNumber" + index;
  const transformed = new MagicString(code);
  for (const call of calls) transformed.overwrite(call.start, call.end, alias);
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
