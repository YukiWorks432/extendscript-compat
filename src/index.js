import { parse, traverse } from "@babel/core";

/** @param {string} source @returns {import("./index.d.ts").PrecedenceDiagnostic[]} */
export function findPrecedenceIssues(source) {
  // 呼び出し元のBabel設定によって括弧の解析方法が変わることを防ぐ。
  const program = parseScript(source);
  /** @type {import("./index.d.ts").PrecedenceDiagnostic[]} */
  const operands = [];
  /** @param {import("@babel/core").Node} node @param {import("./index.d.ts").PrecedenceDiagnostic["kind"]} kind */
  const collect = (node, kind) => {
    operands.push({ kind, ...sourcePosition(node) });
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
export function protectPrecedence(source) {
  const insertions = findPrecedenceIssues(source)
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
export function assertPrecedenceProtected(source) {
  const operands = findPrecedenceIssues(source);
  if (operands.length > 0) {
    const positions = operands.map(({ line, column }) => line + ":" + column).join(", ");
    throw new Error(
      "ExtendScript host bundle contains unprotected expression precedence at " + positions,
    );
  }
}

/** @param {string} source @returns {import("./index.d.ts").CompatibilityDiagnostic[]} */
export function findCompatibilityIssues(source) {
  return analyzeCompatibility(source).diagnostics;
}

/** @param {string} source @param {{unicode?: boolean}} [options] @returns {import("./index.d.ts").CompatibilityProtection} */
export function protectCompatibility(source, options = {}) {
  const { diagnostics, continueEdits, program } = analyzeCompatibility(source);
  /** @type {import("./index.d.ts").SourceEdit[]} */
  const edits = findPrecedenceIssues(source).flatMap(({ start, end }) => [
    { start, end: start, text: "(" },
    { start: end, end, text: ")" },
  ]);
  edits.push(...continueEdits);
  if (options.unicode) edits.push(...findUnicodeEdits(source, program));
  for (const diagnostic of diagnostics) {
    if (diagnostic.code === "EC-06") {
      edits.push({ start: diagnostic.start, end: diagnostic.end, text: "\\-" });
    } else if (diagnostic.kind === "labeled-continue-semicolon") {
      edits.push({ start: diagnostic.end, end: diagnostic.end, text: ";" });
    }
  }
  edits.sort((left, right) => {
    if (left.start !== right.start) return left.start - right.start;
    if (left.end !== right.end) return left.end - right.end;
    return left.text === ")" ? -1 : 1;
  });
  let code = "";
  let cursor = 0;
  for (const edit of edits) {
    code += source.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  return {
    code: code + source.slice(cursor),
    edits,
    diagnostics: diagnostics.filter(({ kind }) => kind === "continue-through-switch"),
  };
}

/**
 * @param {string} source
 * @returns {import("./index.d.ts").UnicodeProtection}
 */
export function protectUnicode(source) {
  const edits = findUnicodeEdits(source);
  let cursor = 0;
  let code = "";
  for (const edit of edits) {
    code += source.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  return { code: code + source.slice(cursor), edits };
}

/** @param {string} source @param {ReturnType<typeof parseScript>} [program] @returns {import("./index.d.ts").SourceEdit[]} */
function findUnicodeEdits(source, program = parseScript(source)) {
  /** @type {import("./index.d.ts").SourceEdit[]} */
  const edits = [];
  const covered = new Set();
  /** @param {import("@babel/core").Node} node */
  const escapeLiteral = (node) => {
    const { start, end } = sourcePosition(node);
    for (let index = start; index < end; index++) {
      const code = source.charCodeAt(index);
      if (code !== 0x200c && code !== 0x200d && code !== 0xfeff) continue;
      covered.add(index);
      let slash = index;
      while (slash > start && source[slash - 1] === "\\") slash--;
      // 直前が奇数個のバックスラッシュなら、最後の1個は元の文字のエスケープ。
      const editStart = (index - slash) % 2 ? index - 1 : index;
      edits.push({
        start: editStart,
        end: index + 1,
        text: "\\u" + code.toString(16).padStart(4, "0"),
      });
    }
  };
  traverse(program, {
    StringLiteral({ node }) {
      escapeLiteral(node);
    },
    DirectiveLiteral({ node }) {
      escapeLiteral(node);
    },
    RegExpLiteral({ node }) {
      escapeLiteral(node);
    },
    Identifier({ node }) {
      if (/(?:\u200c|\u200d|\ufeff)/.test(node.name)) {
        const { line, column } = sourcePosition(node);
        throw new SyntaxError(
          "Unsupported Unicode character in identifier at " + line + ":" + column,
        );
      }
    },
  });
  for (let index = 0; index < source.length; index++) {
    const code = source.charCodeAt(index);
    if ((code === 0x200c || code === 0x200d || code === 0xfeff) && !covered.has(index)) {
      const before = source.slice(0, index).split(/\r\n|[\r\n\u2028\u2029]/);
      throw new SyntaxError(
        "Unsupported Unicode character outside a string or regular expression at " +
          before.length +
          ":" +
          before[before.length - 1].length,
      );
    }
  }
  return edits.toSorted((a, b) => a.start - b.start);
}

/** @param {string} source */
function analyzeCompatibility(source) {
  const program = parseScript(source);
  /** @type {import("./index.d.ts").CompatibilityDiagnostic[]} */
  const diagnostics = [];
  // 後から現れるラベルや識別子との衝突も避けるため、先に名前を収集する。
  const usedNames = new Set();
  traverse(program, {
    Identifier({ node }) {
      usedNames.add(node.name);
    },
  });
  /** @type {Map<import("@babel/core").Node, string>} */
  const loopLabels = new Map();
  /** @type {import("./index.d.ts").SourceEdit[]} */
  const continueEdits = [];
  let nextLabel = 0;
  traverse(program, {
    ContinueStatement(path) {
      // ラベル付きcontinueは、圧縮で省略されたセミコロンを最終出力へ戻す。
      if (path.node.label) {
        const position = sourcePosition(path.node);
        if (source[position.end - 1] !== ";") {
          diagnostics.push({
            code: "EC-03",
            kind: "labeled-continue-semicolon",
            ...position,
            message: "ラベル付きcontinueの末尾へ、ExtendScriptで必要なセミコロンを補います。",
          });
        }
        return;
      }
      let crossesSwitch = false;
      const loop = path.findParent((parent) => {
        if (parent.isSwitchStatement()) crossesSwitch = true;
        return parent.isLoop();
      });
      if (!crossesSwitch || !loop) return;
      const position = sourcePosition(path.node);
      let label = loopLabels.get(loop.node);
      if (!label) {
        if (loop.parentPath?.isLabeledStatement()) {
          label = loop.parentPath.node.label.name;
        } else {
          do {
            label = "__extendscriptCompatLoop" + nextLabel++;
          } while (usedNames.has(label));
          usedNames.add(label);
          const target = sourcePosition(loop.node);
          continueEdits.push({ start: target.start, end: target.start, text: label + ": " });
        }
        loopLabels.set(loop.node, label);
      }
      // コメントと元のセミコロンを残し、ASIで終わるcontinueにはセミコロンも補う。
      const insertion = position.start + "continue".length;
      continueEdits.push({
        start: insertion,
        end: insertion,
        text: " " + label + (source[position.end - 1] === ";" ? "" : ";"),
      });
      diagnostics.push({
        code: "EC-03",
        kind: "continue-through-switch",
        ...position,
        message: "switchをまたぐcontinueを、対象ループのラベルを指定する形へ自動補正します。",
      });
    },
    RegExpLiteral(path) {
      const node = path.node;
      if (/[^gim]/.test(node.flags)) return;
      const position = sourcePosition(node);
      const pattern = node.pattern;
      let inClass = false;
      for (let index = 0; index < pattern.length; index++) {
        const character = pattern[index];
        if (character === "\\") {
          const hex = pattern.slice(index, index + 4);
          const unicode = pattern.slice(index, index + 6);
          let length = 0;
          if (hex.slice(0, 2) === "\\x" && hex.slice(2).toLowerCase() === "2d") length = 4;
          if (unicode.slice(0, 2) === "\\u" && unicode.slice(2).toLowerCase() === "002d")
            length = 6;
          if (inClass && length) {
            diagnostics.push({
              code: "EC-06",
              kind: "regexp-escaped-hyphen",
              start: position.start + 1 + index,
              end: position.start + 1 + index + length,
              line: position.line,
              column: position.column + 1 + index,
              message: "文字クラス内の16進表記のハイフンを明示的なエスケープへ補正します。",
            });
            index += length - 1;
          } else {
            index++;
          }
        } else if (character === "[") {
          inClass = true;
        } else if (character === "]") {
          inClass = false;
        }
      }
    },
  });
  return {
    diagnostics: diagnostics.toSorted((left, right) => left.start - right.start),
    continueEdits,
    program,
  };
}

/** @param {string} source */
function parseScript(source) {
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
  return program;
}

/** @param {import("@babel/core").Node} node */
function sourcePosition(node) {
  if (node.start == null || node.end == null || !node.loc) {
    throw new Error("ExtendScript compatibility pass found a node without source positions");
  }
  return {
    start: node.start,
    end: node.end,
    line: node.loc.start.line,
    column: node.loc.start.column,
  };
}
