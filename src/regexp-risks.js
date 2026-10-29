import { parse, traverse } from "@babel/core";
import { RegExpParser, RegExpSyntaxError, visitRegExpAST } from "@eslint-community/regexpp";

/** @param {string} source @returns {import("./index.d.ts").RegExpRiskDiagnostic[]} */
export function findRegExpRisks(source) {
  const program = parse(source, {
    babelrc: false,
    configFile: false,
    sourceType: "script",
    parserOpts: { allowReturnOutsideFunction: true, errorRecovery: false },
  });
  if (!program) throw new Error("ExtendScript regexp risk pass received an empty AST");
  /** @type {import("./index.d.ts").RegExpRiskDiagnostic[]} */
  const diagnostics = [];
  const parser = new RegExpParser();
  traverse(program, {
    RegExpLiteral({ node }) {
      if (/[^gim]/.test(node.flags)) return;
      let pattern;
      try {
        pattern = parser.parsePattern(node.pattern);
      } catch (error) {
        if (error instanceof RegExpSyntaxError) return;
        throw error;
      }
      let optionalInAlternative = false;
      let nestedAlternative = false;
      visitRegExpAST(pattern, {
        onQuantifierEnter(quantifier) {
          if (quantifier.max < 2) return;
          const body = quantifier.element;
          if (body.type !== "Group" && body.type !== "CapturingGroup") return;
          let hasAlternative = false;
          let hasOptional = false;
          /** @param {import("@eslint-community/regexpp").AST.Group | import("@eslint-community/regexpp").AST.CapturingGroup} group */
          const checkGroup = (group) => {
            if (group.alternatives.length < 2) return;
            hasAlternative = true;
            /** @type {import("@eslint-community/regexpp").AST.Node | null} */
            let ancestor = group.parent;
            while (ancestor && ancestor !== body.parent) {
              if (
                (ancestor.type === "Group" || ancestor.type === "CapturingGroup") &&
                ancestor.alternatives.length > 1
              ) {
                nestedAlternative = true;
                break;
              }
              ancestor = ancestor.parent;
            }
          };
          visitRegExpAST(body, {
            onGroupEnter: checkGroup,
            onCapturingGroupEnter: checkGroup,
            onQuantifierEnter(inner) {
              if (inner.min === 0) hasOptional = true;
            },
          });
          if (hasAlternative && hasOptional) optionalInAlternative = true;
        },
      });
      if (node.start == null || node.end == null || !node.loc)
        throw new Error("ExtendScript regexp risk pass found a node without source positions");
      const position = {
        start: node.start,
        end: node.end,
        line: node.loc.start.line,
        column: node.loc.start.column,
      };
      if (optionalInAlternative) {
        diagnostics.push({
          code: "EC-18",
          kind: "regexp-optional-alternative-repeat",
          ...position,
          message:
            "繰り返しの中に選択肢と省略可能な要素があります。ExtendScriptで停止する可能性があります。",
        });
      }
      if (nestedAlternative) {
        diagnostics.push({
          code: "EC-19",
          kind: "regexp-nested-alternative-repeat",
          ...position,
          message:
            "繰り返しの中に入れ子の選択肢があります。ExtendScriptで一致結果が変わる可能性があります。",
        });
      }
    },
  });
  return diagnostics;
}
