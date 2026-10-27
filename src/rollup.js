import { fileURLToPath } from "node:url";
import { addSegment, GenMapping, setSourceContent, toEncodedMap } from "@jridgewell/gen-mapping";
import { eachMapping, TraceMap } from "@jridgewell/trace-mapping";
import { protectCompatibility, assertPrecedenceProtected } from "./index.js";
import { numberPonyfillImport, transformNumberCalls } from "./number-transform.js";

/** @param {string} source */
const lineStarts = (source) => {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\r") {
      if (source[index + 1] === "\n") index += 1;
      starts.push(index + 1);
    } else if (source[index] === "\n") {
      starts.push(index + 1);
    }
  }
  return starts;
};

/** @param {string} before @param {string} after @param {import("./index.d.ts").SourceEdit[]} edits @param {import("rollup").SourceMap} original @param {string} filename @returns {import("rollup").SourceMap} */
function shiftSourceMap(before, after, edits, original, filename) {
  const input = new TraceMap(original.toString());
  const map = new GenMapping({ file: filename });
  const oldStarts = lineStarts(before);
  const newStarts = lineStarts(after);
  let delta = 0;
  const changes = edits.map((edit) => {
    const newStart = edit.start + delta;
    delta += edit.text.length - (edit.end - edit.start);
    return { ...edit, newStart, delta };
  });
  eachMapping(input, (mapping) => {
    const oldLine = oldStarts[mapping.generatedLine - 1];
    if (oldLine === undefined) throw new Error("Invalid generated line in ExtendScript source map");
    const offset = oldLine + mapping.generatedColumn;
    let low = 0;
    let high = changes.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (changes[middle].start <= offset) low = middle + 1;
      else high = middle;
    }
    const change = changes[low - 1];
    const shifted = !change
      ? offset
      : offset >= change.end
        ? offset + change.delta
        : change.newStart + Math.min(offset - change.start, change.text.length);
    let line = 0;
    let end = newStarts.length;
    while (line + 1 < end) {
      const middle = Math.floor((line + end) / 2);
      if (newStarts[middle] <= shifted) line = middle;
      else end = middle;
    }
    const column = shifted - newStarts[line];
    if (
      mapping.source === null ||
      mapping.originalLine === null ||
      mapping.originalColumn === null
    ) {
      addSegment(map, line, column);
    } else if (mapping.name === null) {
      addSegment(
        map,
        line,
        column,
        mapping.source,
        mapping.originalLine - 1,
        mapping.originalColumn,
      );
    } else {
      addSegment(
        map,
        line,
        column,
        mapping.source,
        mapping.originalLine - 1,
        mapping.originalColumn,
        mapping.name,
      );
    }
  });
  input.resolvedSources.forEach((source, index) => {
    const content = input.sourcesContent?.[index];
    if (content !== null && content !== undefined) setSourceContent(map, source, content);
  });
  const encoded = toEncodedMap(map);
  const serializable = {
    ...encoded,
    file: filename,
    sources: encoded.sources.map((source) => source ?? ""),
    names: [...encoded.names],
    sourcesContent: encoded.sourcesContent?.map((content) => content ?? null),
  };
  const serialized = JSON.stringify(serializable);
  return {
    ...serializable,
    toString: () => serialized,
    toUrl: () =>
      "data:application/json;charset=utf-8;base64," + Buffer.from(serialized).toString("base64"),
  };
}

/** @param {string} code @param {string | undefined} url */
function updateSourceMappingUrl(code, url) {
  const lines = code.split(/(\r\n|\r|\n)/);
  let found = false;
  for (let index = 0; index < lines.length; index += 2) {
    if (!/^[ \t]*\/\/[#@]\s*sourceMappingURL=/.test(lines[index])) continue;
    found = true;
    lines[index] = url ? "//# sourceMappingURL=" + url : "";
  }
  const result = lines.join("");
  return url && !found ? result + "\n//# sourceMappingURL=" + url : result;
}

/** @param {import("./rollup.d.ts").CompatibilityOptions} [options] @returns {import("rollup").Plugin} */
export function extendscriptCompat(options = {}) {
  const diagnostics = options.diagnostics ?? "warn";
  if (!["warn", "error", "off"].includes(diagnostics)) {
    throw new TypeError("Unknown ExtendScript diagnostics mode: " + diagnostics);
  }
  const numberPonyfillPath = fileURLToPath(
    new URL("../runtime/number.js", import.meta.url),
  ).replace(/\\/g, "/");
  const runtimePath = fileURLToPath(new URL("../runtime/index.js", import.meta.url)).replace(
    /\\/g,
    "/",
  );
  return {
    name: "extendscript-compat",
    resolveId(source) {
      if (source === numberPonyfillImport) return numberPonyfillPath;
      return null;
    },
    transform(code, id) {
      const normalizedId = id.replace(/\\/g, "/");
      if (normalizedId === numberPonyfillPath || normalizedId === runtimePath) return null;
      const result = transformNumberCalls(code, id);
      if (!result) return null;
      if (diagnostics !== "off") {
        for (const position of result.diagnostics) {
          const warning = {
            code: "NUMBER_UNSUPPORTED",
            message: "安全に変換できないNumberの参照は自動補正されません。",
            loc: { file: id, ...position },
          };
          if (diagnostics === "error") this.error(warning);
          else this.warn(warning);
        }
      }
      return result.code === undefined ? null : { code: result.code, map: result.map };
    },
    generateBundle(options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue;
        const source = chunk.code;
        const result = protectCompatibility(source);
        if (diagnostics !== "off") {
          for (const diagnostic of result.diagnostics) {
            const warning = {
              code: diagnostic.code,
              message: diagnostic.message,
              loc: { file: chunk.fileName, line: diagnostic.line, column: diagnostic.column },
            };
            if (diagnostics === "error") this.error(warning);
            else this.warn(warning);
          }
        }
        assertPrecedenceProtected(result.code);
        chunk.code = result.code;
        if (!options.sourcemap || result.edits.length === 0) continue;
        if (!chunk.map)
          this.error("ExtendScript compatibility pass requires the preceding source map");
        const map = shiftSourceMap(source, result.code, result.edits, chunk.map, chunk.fileName);
        chunk.map = map;
        if (options.sourcemap === "inline") {
          chunk.code = updateSourceMappingUrl(chunk.code, map.toUrl());
        } else {
          const mapFile = chunk.sourcemapFileName ?? chunk.fileName + ".map";
          const asset = bundle[mapFile];
          if (!asset || asset.type !== "asset")
            this.error("ExtendScript source map asset is missing: " + mapFile);
          asset.source = map.toString();
        }
      }
    },
  };
}
