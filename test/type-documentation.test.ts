import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";

it.each(["lib.es5.d.ts", "lib.es2022.d.ts", "lib.es2024.d.ts"])(
  "%sと公開ランタイム型の併用時に補完説明を取得できる",
  (lib) => {
    const file = fileURLToPath(new URL("./types/documentation-probe.ts", import.meta.url));
    const source = [
      'import "../../runtime/index.js";',
      "const values = [1, 2];",
      "values.toSorted();",
      "values.findLast(x => x > 1);",
      "Object.entries({ a: 1 });",
      '"test".replaceAll("e", () => "a");',
    ].join("\n");
    const options: ts.CompilerOptions = {
      strict: true,
      noEmit: true,
      lib: [lib],
      types: [],
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Node10,
    };
    const isFixture = (name: string) => path.resolve(name) === file;
    const service = ts.createLanguageService({
      getScriptFileNames: () => [file],
      getScriptVersion: () => "1",
      getScriptSnapshot: (name) => {
        const text = isFixture(name) ? source : ts.sys.readFile(name);
        return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
      },
      getCurrentDirectory: () => process.cwd(),
      getCompilationSettings: () => options,
      getDefaultLibFileName: (settings) => ts.getDefaultLibFilePath(settings),
      fileExists: (name) => isFixture(name) || ts.sys.fileExists(name),
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
    });
    try {
      for (const name of ["toSorted", "findLast", "entries", "replaceAll"]) {
        const info = service.getQuickInfoAtPosition(file, source.indexOf(name) + 1);
        expect(ts.displayPartsToString(info?.documentation)).not.toEqual("");
      }
    } finally {
      service.dispose();
    }
  },
);
