import { addSegment, GenMapping, setSourceContent, toEncodedMap } from "@jridgewell/gen-mapping";
import { eachMapping, TraceMap } from "@jridgewell/trace-mapping";
import {
  protectExtendscriptExpressionPrecedence,
  assertExtendscriptExpressionPrecedenceProtected,
} from "./index.js";

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

/** @param {string} before @param {string} after @param {number[]} insertions @param {import("rollup").SourceMap} original @param {string} filename @returns {import("rollup").SourceMap} */
function shiftSourceMap(before, after, insertions, original, filename) {
  const input = new TraceMap(original.toString());
  const map = new GenMapping({ file: filename });
  const oldStarts = lineStarts(before);
  const newStarts = lineStarts(after);
  eachMapping(input, (mapping) => {
    const oldLine = oldStarts[mapping.generatedLine - 1];
    if (oldLine === undefined) throw new Error("Invalid generated line in ExtendScript source map");
    const offset = oldLine + mapping.generatedColumn;
    let low = 0;
    let high = insertions.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (insertions[middle] <= offset) low = middle + 1;
      else high = middle;
    }
    const shifted = offset + low;
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

/** @returns {import("rollup").Plugin} */
export function extendscriptCompat() {
  return {
    name: "extendscript-compat",
    generateBundle(options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue;
        const source = chunk.code;
        const result = protectExtendscriptExpressionPrecedence(source);
        assertExtendscriptExpressionPrecedenceProtected(result.code);
        chunk.code = result.code;
        if (!options.sourcemap || result.insertions.length === 0) continue;
        if (!chunk.map)
          this.error("ExtendScript compatibility pass requires the preceding source map");
        const map = shiftSourceMap(
          source,
          result.code,
          result.insertions,
          chunk.map,
          chunk.fileName,
        );
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
