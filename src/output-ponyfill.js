// Rollupの出力側で補完を供給する。
import { fileURLToPath } from "node:url";
import { parse, traverse, transformFromAstSync, types as t } from "@babel/core";
import { numberPonyfillImport } from "./number-transform.js";
import { findFreezeEdits } from "./freeze-transform.js";

import { globals, factorySource } from "../runtime/ponyfill-factory.js";
import { transformPonyfills as transformOutput } from "./ponyfill-transform.js";
const tag = "extendscript-compat:output-runtime:v1";
const factoryName = "__extendscriptCompatOutputFactory__";
const useName = "__extendscriptCompatOutputUse__";
const runtimeId = "\0extendscript-compat:output:runtime";
const numberId = "\0extendscript-compat:output:number";
const numberPath = fileURLToPath(new URL("../runtime/number.js", import.meta.url));

const bridge = `var cache; export function runtime() { return cache || (cache = ${factoryName}(${JSON.stringify(tag)},${globals.map((name) => `typeof ${name} === "undefined" ? void 0 : ${name}`).join(",")})); }`;
const numberBridge =
  'import { runtime } from "extendscript-compat:output:runtime"; export function toNumber(){ return runtime().toNumber.apply(void 0, arguments); }';

/** @param {string} source */
function expression(source) {
  const ast = parse(source);
  if (!ast || !t.isExpressionStatement(ast.program.body[0]))
    throw new Error("補完式を解析できません");
  return ast.program.body[0].expression;
}
const factoryExpression = expression("(" + factorySource + ")");
/** @param {import("@babel/core").types.Node} node @param {string} name */
const isMarker = (node, name) =>
  t.isCallExpression(node) &&
  t.isIdentifier(node.callee, { name }) &&
  t.isStringLiteral(node.arguments[0], { value: tag });

export function createOutputPonyfill() {
  const rendered = new Map();
  return {
    numberBridge,
    /** @param {string} source */
    resolveId(source) {
      if (source === "extendscript-compat:output:runtime") return runtimeId;
      if (source === numberPonyfillImport) return numberId;
      if (source === "extendscript-compat/runtime") return "\0extendscript-compat:output:empty";
      return null;
    },
    /** @param {string} id */
    load(id) {
      if (id === runtimeId) return bridge;
      if (id === numberId) return numberBridge;
      if (id === "\0extendscript-compat:output:empty") return "";
      return null;
    },
    /** @param {string} code @param {string} id @param {import("@babel/core").TransformOptions["inputSourceMap"]} inputSourceMap */
    prepareModule(code, id, inputSourceMap) {
      const ast = parse(code, { babelrc: false, configFile: false, sourceType: "module" });
      if (!ast) throw new Error("入力を解析できません");
      let alias;
      traverse(ast, {
        Program(path) {
          alias = path.scope.generateUidIdentifier("outputRuntime").name;
        },
      });
      const prefix = /** @type {import("@babel/core").types.File} */ (
        parse(
          `import {runtime as ${alias}} from "extendscript-compat:output:runtime";\n${useName}(${JSON.stringify(tag)},${alias},${alias});`,
          { sourceType: "module" },
        )
      ).program.body;
      ast.program.body.unshift(...prefix.map((node) => t.cloneNode(node, true, true)));
      const result = transformFromAstSync(ast, code, {
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        sourceFileName: id,
        inputSourceMap,
      });
      if (!result?.code) throw new Error("補完接続の生成に失敗しました");
      return { code: result.code, map: result.map };
    },
    renderChunk: {
      order: /** @type {const} */ ("post"),
      /** @param {string} code @param {import("rollup").RenderedChunk} chunk @param {import("rollup").NormalizedOutputOptions} _options @param {{chunks:Record<string,import("rollup").RenderedChunk>}} meta */
      handler(code, chunk, _options, meta) {
        /** @type {any[][]} */ const skipped = [];
        let connected = false;
        /** @type {any} */ let helperBinding;
        const freezeEdits = findFreezeEdits(code);
        const result = transformOutput(code, chunk.fileName, undefined, {
          prepare(programPath) {
            /** @type {any} */ let getter;

            const names = new Set();
            programPath.traverse({
              Identifier(path) {
                names.add(path.node.name);
              },
            });
            let safe = "__extendscriptOutputRuntime";
            for (let suffix = 0; names.has(safe); suffix++)
              safe = "__extendscriptOutputRuntime" + suffix;
            programPath.traverse({
              CallExpression(path) {
                if (!isMarker(path.node, factoryName)) return;
                const owner = /** @type {any} */ (path.findParent((parent) => parent.isFunction()));
                if (owner.isFunctionExpression()) {
                  const body = owner.node.body;
                  const declaration = t.functionDeclaration(
                    t.identifier(safe),
                    owner.node.params,
                    body,
                  );
                  const container = owner.findParent(
                    (/** @type {import("@babel/core").NodePath} */ parent) =>
                      parent.isProgram() || parent.isBlockStatement(),
                  );
                  container.unshiftContainer("body", declaration);
                  owner.replaceWith(t.identifier(safe));
                  programPath.scope.crawl();
                  path.skip();
                }
              },
            });
            programPath.traverse({
              CallExpression(path) {
                if (isMarker(path.node, useName)) {
                  if (
                    !(
                      t.isIdentifier(path.node.arguments[1]) ||
                      t.isMemberExpression(path.node.arguments[1])
                    )
                  )
                    throw new Error("圧縮後の接続が識別子でなくなりました: " + chunk.fileName);
                  getter = path.get("arguments.1");
                }
                if (isMarker(path.node, factoryName)) {
                  const owner = /** @type {any} */ (
                    path.findParent((parent) => parent.isFunction())
                  );
                  if (!owner?.isFunctionDeclaration())
                    throw new Error("補完の接続が巻き上げ可能な関数でなくなりました");
                  skipped.push([owner.node.body.start, owner.node.body.end]);
                  getter ??= owner.get("id");
                }
              },
            });
            if (!getter) return t.identifier("__unavailableOutputRuntime");
            connected = true;
            let root = getter;
            while (root.isMemberExpression()) root = root.get("object");
            if (!root.isIdentifier()) throw new Error("補完接続の束縛を取得できません");
            const binding = root.scope.getBinding(root.node.name);
            if (!binding) throw new Error("補完接続がローカルな束縛ではありません");
            binding.scope.rename(root.node.name, safe);
            helperBinding = binding;
            return t.callExpression(t.cloneNode(getter.node, true), []);
          },
          assertScope(path) {
            if (connected && path.scope.getBinding(helperBinding.identifier.name) !== helperBinding)
              throw new Error(
                "補完の接続が届かないスコープにコードが追加されています: " + chunk.fileName,
              );
          },
          skip: (path) =>
            skipped.some(
              ([start, end]) =>
                path.node.start != null &&
                path.node.end != null &&
                path.node.start >= start &&
                path.node.end <= end,
            ),
          finish(program, changed) {
            if (!connected) {
              if (changed)
                throw new Error("補完が必要なチャンクに接続がありません: " + chunk.fileName);
              return false;
            }
            traverse(program, {
              CallExpression(path) {
                const callee = path.node.callee;
                const edit = freezeEdits.find(
                  (item) => item.start === callee.start && item.end === callee.end,
                );
                if (edit) {
                  path.get("callee").replaceWith(t.cloneNode(expression(edit.text), true, true));
                  path.skip();
                }
              },
            });
            const omit =
              !changed &&
              !chunk.moduleIds.includes(numberId) &&
              !chunk.moduleIds.includes(numberPath) &&
              Object.keys(meta.chunks).length === 1;
            if (omit) {
              /** @type {import("@babel/core").NodePath[]} */ const removals = [];
              traverse(program, {
                CallExpression(path) {
                  if (isMarker(path.node, factoryName)) {
                    const owner = /** @type {any} */ (
                      path.findParent((parent) => parent.isFunction())
                    );
                    const cache = path.findParent((parent) => parent.isAssignmentExpression());
                    const binding = cache?.get("left").isIdentifier()
                      ? cache.scope.getBinding(/** @type {any} */ (cache.node).left.name)
                      : undefined;
                    removals.push(owner);
                    if (binding) removals.push(binding.path);
                  } else if (isMarker(path.node, useName)) {
                    if (path.parentPath.isExpressionStatement()) path.parentPath.remove();
                    else path.replaceWith(t.numericLiteral(0));
                  }
                },
              });
              for (const path of removals) if (!path.removed) path.remove();
              return;
            }
            traverse(program, {
              CallExpression(path) {
                if (isMarker(path.node, factoryName)) {
                  // 前段の参照予約で利用側の同名変数を退避済み。値は捕捉せず、その後の参照変更も保つ。
                  for (const name of globals)
                    if (path.scope.getBinding(name))
                      throw new Error("補完本体のグローバル名が捕捉されます: " + name);
                  const body = t.cloneNode(factoryExpression, true, true);
                  /** @type {any} */ (body).body.directives = [
                    t.directive(t.directiveLiteral(tag)),
                  ];
                  path.replaceWith(t.callExpression(body, []));
                  path.skip();
                } else if (isMarker(path.node, useName)) {
                  if (path.parentPath.isExpressionStatement()) path.parentPath.remove();
                  else path.replaceWith(t.numericLiteral(0));
                }
              },
            });
          },
        });
        rendered.set(chunk.fileName, result?.code ?? code);
        return result;
      },
    },
    /** @param {import("rollup").OutputBundle} bundle */
    checkBundle(bundle) {
      for (const chunk of Object.values(bundle)) {
        if (
          chunk.type !== "chunk" ||
          chunk.code === rendered.get(chunk.preliminaryFileName ?? chunk.fileName)
        )
          continue;
        // 遅い展開を黙って通さないため、挿入済みの本体だけ構造で除外して再検査する。
        /** @type {string[]} */ const targets = [];
        const runtimeOwners = new Set();
        transformOutput(chunk.code, chunk.fileName, undefined, {
          prepare(programPath) {
            programPath.traverse({
              Function(path) {
                if (
                  t.isBlockStatement(path.node.body) &&
                  path.node.body.directives?.some((directive) => directive.value.value === tag)
                )
                  runtimeOwners.add(path.findParent((parent) => parent.isFunction())?.node);
              },
            });
            return t.identifier("__diagnosticOnly");
          },
          assertScope(path) {
            if (targets.length < 4)
              targets.push(
                chunk.code.slice(path.node.start ?? undefined, path.node.end ?? undefined),
              );
          },
          skip(path) {
            return !!path.findParent((parent) => runtimeOwners.has(parent.node));
          },
          finish(_program, changed) {
            if (changed) {
              throw new Error(
                "renderChunk後に補完対象のコードが追加されています: " +
                  chunk.fileName +
                  " " +
                  JSON.stringify(targets),
              );
            }
            return false;
          },
        });
      }
    },
  };
}
