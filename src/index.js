import { parse, traverse } from "@babel/core";

/** @param {string} source @returns {import("./index.d.ts").PrecedenceDiagnostic[]} */
export function findUnprotectedExtendscriptExpressionPrecedence(source) {
  // 呼び出し元のBabel設定によって括弧の解析方法が変わることを防ぐ。
  const program = parse(source, {
    babelrc: false,
    configFile: false,
    sourceType: "script",
    parserOpts: {
      allowReturnOutsideFunction: true,
      createParenthesizedExpressions: true,
      errorRecovery: false,
    },
  });
  if (!program) throw new Error("ExtendScript expression precedence pass received an empty AST");
  /** @type {import("./index.d.ts").PrecedenceDiagnostic[]} */
  const operands = [];
  /** @param {import("@babel/core").Node} node @param {import("./index.d.ts").PrecedenceDiagnostic["kind"]} kind */
  const collect = (node, kind) => {
    if (node.start == null || node.end == null || !node.loc) {
      throw new Error(
        "ExtendScript expression precedence pass found a node without source positions",
      );
    }
    operands.push({
      kind,
      start: node.start,
      end: node.end,
      line: node.loc.start.line,
      column: node.loc.start.column,
    });
  };
  traverse(program, {
    LogicalExpression(path) {
      for (const operand of [path.node.left, path.node.right]) {
        if (operand.type === "LogicalExpression" && operand.operator !== path.node.operator) {
          collect(operand, "mixed-logical");
        }
      }
    },
    ConditionalExpression(path) {
      for (const operand of [path.node.test, path.node.consequent, path.node.alternate]) {
        if (operand.type === "ConditionalExpression") collect(operand, "nested-conditional");
      }
    },
  });
  return operands;
}

/** @param {string} source */
export function protectExtendscriptExpressionPrecedence(source) {
  const insertions = findUnprotectedExtendscriptExpressionPrecedence(source)
    .flatMap(({ start, end }) => [
      { position: start, text: "(" },
      { position: end, text: ")" },
    ])
    .toSorted((left, right) =>
      left.position !== right.position
        ? left.position - right.position
        : left.text === ")"
          ? -1
          : 1,
    );
  let code = "";
  let cursor = 0;
  for (const insertion of insertions) {
    code += source.slice(cursor, insertion.position) + insertion.text;
    cursor = insertion.position;
  }
  return {
    code: code + source.slice(cursor),
    insertions: insertions.map(({ position }) => position),
  };
}

/** @param {string} source */
export function assertExtendscriptExpressionPrecedenceProtected(source) {
  const operands = findUnprotectedExtendscriptExpressionPrecedence(source);
  if (operands.length > 0) {
    const positions = operands.map(({ line, column }) => line + ":" + column).join(", ");
    throw new Error(
      "ExtendScript host bundle contains unprotected expression precedence at " + positions,
    );
  }
}
