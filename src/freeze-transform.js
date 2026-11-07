import { parse, traverse } from "@babel/core";
import { getFreeze } from "../runtime/freeze.js";

/** Rollupがモジュール変換後に追加する呼び出しも、ホストを変更せず補正する。
 * @param {string} source @returns {import("./index.d.ts").SourceEdit[]} */
export function findFreezeEdits(source) {
  const program = parse(source, {
    babelrc: false,
    configFile: false,
    sourceType: "script",
    parserOpts: { allowReturnOutsideFunction: true },
  });
  /** @type {import("./index.d.ts").SourceEdit[]} */
  const edits = [];
  if (!program) return edits;
  traverse(program, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (
        callee.type !== "MemberExpression" ||
        callee.object.type !== "Identifier" ||
        callee.object.name !== "Object" ||
        path.scope.getBinding("Object") ||
        (callee.computed
          ? callee.property.type !== "StringLiteral" || callee.property.value !== "freeze"
          : callee.property.type !== "Identifier" || callee.property.name !== "freeze")
      )
        return;
      if (callee.start == null || callee.end == null)
        throw new Error("Freeze call has no source position");
      edits.push({
        start: callee.start,
        end: callee.end,
        text: "(" + getFreeze.toString() + ")(Object)",
      });
    },
  });
  return edits.sort((a, b) => a.start - b.start);
}
