import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// npm自身のCLIをNode.jsで起動し、Windowsでもシェルを経由せずに導入する。
assert(
  process.env.npm_config_user_agent?.startsWith("npm/"),
  "npm run check:packageで実行してください",
);
const npmCli = process.env.npm_execpath;
assert(npmCli, "npm CLIのパスを取得できませんでした");
const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const tarball = resolve(process.argv[2] ?? `artifacts/${manifest.name}-${manifest.version}.tgz`);
const consumer = mkdtempSync(join(tmpdir(), "extendscript-compat-consumer-"));

try {
  cpSync(new URL("../test/fixtures/package-consumer", import.meta.url), consumer, {
    recursive: true,
  });
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({
      name: "extendscript-compat-consumer",
      private: true,
      type: "module",
      devDependencies: Object.fromEntries(
        ["rollup", "@rollup/plugin-terser", "typescript"].map((name) => [
          name,
          manifest.devDependencies[name],
        ]),
      ),
    }),
  );
  const options = { cwd: consumer, stdio: /** @type {const} */ ("inherit") };
  execFileSync(
    process.execPath,
    [
      npmCli,
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      tarball,
    ],
    options,
  );
  execFileSync(process.execPath, ["consumer.mjs"], options);
  execFileSync(
    process.execPath,
    [
      "node_modules/typescript/bin/tsc",
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--target",
      "ES2023",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "consumer.ts",
    ],
    options,
  );
  console.log(`配布物の導入・実行・型検査に成功: ${tarball}`);
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
