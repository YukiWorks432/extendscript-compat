import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @param {string} version
 * @param {string} expectedVersion
 * @param {{versions: Record<string, unknown>, "dist-tags": {latest: string}}} registry
 */
export function assertReleaseVersion(version, expectedVersion, registry) {
  assert.equal(version, expectedVersion, "入力した版番号とpackage.jsonが一致しません");
  const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  assert.match(version, stableVersion, "latestには正式版の版番号だけを公開できます");
  assert(!Object.hasOwn(registry.versions, version), `既に公開されている版です: ${version}`);
  const latest = registry["dist-tags"].latest;
  assert.match(
    latest,
    stableVersion,
    "npmのlatestが正式版ではありません。登録状態を確認してください",
  );
  const parts = version.split(".").map(BigInt);
  const latestParts = latest.split(".").map(BigInt);
  const changed = parts.findIndex((value, index) => value !== latestParts[index]);
  assert(
    changed >= 0 && parts[changed] > latestParts[changed],
    `latest (${latest}) より新しい版が必要です`,
  );
}

/**
 * @param {string} name
 * @param {string} version
 * @param {Uint8Array} tarball
 */
export async function verifyPublishedPackage(name, version, tarball) {
  const integrity = "sha512-" + createHash("sha512").update(tarball).digest("base64");
  const deadline = Date.now() + 5 * 60_000;
  while (true) {
    const registry = await (await fetchRegistry(`https://registry.npmjs.org/${name}`)).json();
    const published = registry.versions[version];
    if (published) {
      assert.equal(
        published.dist.integrity,
        integrity,
        "npmのdist.integrityと検証済み配布物が一致しません",
      );
      if (registry["dist-tags"].latest === version) {
        const downloaded = await (await fetchRegistry(published.dist.tarball)).arrayBuffer();
        const downloadedIntegrity =
          "sha512-" + createHash("sha512").update(Buffer.from(downloaded)).digest("base64");
        assert.equal(
          downloadedIntegrity,
          integrity,
          "npmから取得した配布物が検証済み配布物と一致しません",
        );
        return integrity;
      }
    }
    // npmが公開を受理しても、版とlatestが照会結果に反映されるまで数分かかる。
    assert(
      Date.now() < deadline,
      "npmへの反映を5分待ちました。同じ版を再公開せず、登録状態を確認してください",
    );
    console.log(`npmへの反映を待っています: ${name}@${version}`);
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
}

/** @param {string} url */
async function fetchRegistry(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
  assert(response.ok, `npmの照会に失敗しました: HTTP ${response.status} ${url}`);
  return response;
}

// 認証と公開はActions内のnpm CLIが受け持ち、このスクリプトは読み取りだけを行う。
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, argument] = process.argv.slice(2);
  assert(
    command === "check" || command === "verify",
    "check <version> または verify <tarball> を指定してください",
  );
  assert(argument, "版番号または配布物のパスを指定してください");
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  if (command === "check") {
    const registry = await (
      await fetchRegistry(`https://registry.npmjs.org/${manifest.name}`)
    ).json();
    assertReleaseVersion(manifest.version, argument, registry);
    console.log(`未公開の正式版を確認: ${manifest.name}@${manifest.version}`);
  } else {
    const integrity = await verifyPublishedPackage(
      manifest.name,
      manifest.version,
      readFileSync(argument),
    );
    const report = `${manifest.name}@${manifest.version}\nコミット: ${process.env.GITHUB_SHA ?? "ローカル"}\n${integrity}\n`;
    console.log(report);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `公開後の版・配布物の照合に成功しました。\n\n\`\`\`text\n${report}\`\`\`\n`,
      );
    }
  }
}
