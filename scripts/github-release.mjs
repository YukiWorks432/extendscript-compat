import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = "YukiWorks432/extendscript-compat";

// npmの配布物・出所証明を照合してから、同じソースへタグを固定する。
/**
 * @param {string} version
 * @param {{fetch?: (url: string, options?: RequestInit) => Promise<Response>, github?: (method: string, endpoint: string, data?: any, optional?: boolean) => any, expectedCommit?: string}} options
 */
export async function synchronizeRelease(
  version,
  { fetch: request = fetch, github = githubRequest, expectedCommit } = {},
) {
  assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  const read = async (/** @type {string} */ url) => {
    const response = await request(url, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
    assert(response.ok, `照会失敗: ${url} (${response.status})`);
    return response;
  };
  const registry = await (await read("https://registry.npmjs.org/extendscript-compat")).json();
  const published = registry.versions[version];
  assert(published, "npmに指定版がありません");
  assert.equal(published.name, "extendscript-compat");
  assert.equal(published.version, version);
  const archive = Buffer.from(await (await read(published.dist.tarball)).arrayBuffer());
  const digest = createHash("sha512").update(archive);
  assert.equal("sha512-" + digest.copy().digest("base64"), published.dist.integrity);
  const attestations = await (
    await read(`https://registry.npmjs.org/-/npm/v1/attestations/extendscript-compat@${version}`)
  ).json();
  const provenance = attestations.attestations.find(
    (/** @type {any} */ a) => a.predicateType === "https://slsa.dev/provenance/v1",
  );
  assert(provenance, "npmの出所証明がありません");
  const statement = JSON.parse(
    Buffer.from(provenance.bundle.dsseEnvelope.payload, "base64").toString("utf8"),
  );
  const archiveHash = digest.digest("hex");
  assert(
    statement.subject.some(
      (/** @type {any} */ s) =>
        s.name === `pkg:npm/extendscript-compat@${version}` && s.digest.sha512 === archiveHash,
    ),
    "出所証明の配布物が一致しません",
  );
  const definition = statement.predicate.buildDefinition;
  assert.deepEqual(definition.externalParameters.workflow, {
    ref: "refs/heads/main",
    repository: `https://github.com/${repository}`,
    path: ".github/workflows/publish.yml",
  });
  const source = definition.resolvedDependencies.find(
    (/** @type {any} */ d) => d.uri === `git+https://github.com/${repository}@refs/heads/main`,
  );
  const commit = source?.digest.gitCommit;
  assert.match(commit ?? "", /^[a-f0-9]{40}$/);
  if (expectedCommit) assert.equal(commit, expectedCommit, "公開実行とnpmのソースが一致しません");
  const prefix = `repos/${repository}`;
  const manifest = await github("GET", `${prefix}/contents/package.json?ref=${commit}`);
  assert.equal(
    JSON.parse(Buffer.from(manifest.content, "base64").toString("utf8")).version,
    version,
  );
  const notes = await github(
    "GET",
    `${prefix}/contents/docs/releases/${version}.ja.md?ref=${commit}`,
  );
  const tag = `v${version}`;
  const ref = await github("GET", `${prefix}/git/ref/tags/${tag}`, undefined, true);
  if (ref) {
    let object = ref.object;
    while (object.type === "tag")
      object = (await github("GET", `${prefix}/git/tags/${object.sha}`)).object;
    assert.equal(object.type, "commit");
    assert.equal(object.sha, commit, "既存タグの公開元が異なります。タグは移動しません");
  } else {
    await github("POST", `${prefix}/git/refs`, { ref: `refs/tags/${tag}`, sha: commit });
  }
  const existing = await github("GET", `${prefix}/releases/tags/${tag}`, undefined, true);
  if (existing) {
    assert(!existing.draft && !existing.prerelease, "既存Releaseの公開状態を確認してください");
    return { tag, commit, url: existing.html_url, created: false };
  }
  const body =
    `npm: https://www.npmjs.com/package/extendscript-compat/v/${version}\n\n公開元: ${commit}\n\n` +
    Buffer.from(notes.content, "base64")
      .toString("utf8")
      .replace(
        /\]\(([^)]+)\)/g,
        (_, path) =>
          `](${/^(?:[a-z]+:|#)/i.test(path) ? path : new URL(path, `https://github.com/${repository}/blob/${commit}/docs/releases/`).href})`,
      );
  const release = await github("POST", `${prefix}/releases`, {
    tag_name: tag,
    target_commitish: commit,
    name: tag,
    body,
    draft: false,
    prerelease: false,
    make_latest: registry["dist-tags"].latest === version ? "true" : "false",
  });
  return { tag, commit, url: release.html_url, created: true };
}

/** @param {string} method @param {string} endpoint @param {any} [data] @param {boolean} [optional] */
function githubRequest(method, endpoint, data, optional = false) {
  try {
    return JSON.parse(
      execFileSync("gh", ["api", endpoint, "--method", method, ...(data ? ["--input", "-"] : [])], {
        encoding: "utf8",
        input: data ? JSON.stringify(data) : undefined,
        stdio: ["pipe", "pipe", "pipe"],
      }),
    );
  } catch (error) {
    if (optional && String(/** @type {{stderr?: unknown}} */ (error).stderr).includes("(HTTP 404)"))
      return null;
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(
    JSON.stringify(
      await synchronizeRelease(process.argv[2], { expectedCommit: process.env.EXPECTED_COMMIT }),
      null,
      2,
    ),
  );
}
