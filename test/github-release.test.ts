import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { synchronizeRelease } from "../scripts/github-release.mjs";

it("公開と復旧を直列化し、既存の待機処理を置き換えない", () => {
  for (const name of ["publish", "github-release"]) {
    const workflow = readFileSync(
      new URL(`../.github/workflows/${name}.yml`, import.meta.url),
      "utf8",
    );
    const concurrency = workflow.split("\nconcurrency:\n")[1].split("\njobs:")[0];
    expect(concurrency).toMatch(/group: npm-publish/);
    expect(concurrency).toMatch(/queue: max/);
    expect(concurrency).toMatch(/cancel-in-progress: false/);
  }
});

function fixture() {
  const archive = Buffer.from("published npm archive");
  const sha = "1234567890abcdef1234567890abcdef12345678";
  const statement = {
    subject: [
      {
        name: "pkg:npm/extendscript-compat@1.2.0",
        digest: { sha512: createHash("sha512").update(archive).digest("hex") },
      },
    ],
    predicate: {
      buildDefinition: {
        externalParameters: {
          workflow: {
            ref: "refs/heads/main",
            repository: "https://github.com/YukiWorks432/extendscript-compat",
            path: ".github/workflows/publish.yml",
          },
        },
        resolvedDependencies: [
          {
            uri: "git+https://github.com/YukiWorks432/extendscript-compat@refs/heads/main",
            digest: { gitCommit: sha },
          },
        ],
      },
    },
  };
  const registry = {
    versions: {
      "1.2.0": {
        name: "extendscript-compat",
        version: "1.2.0",
        dist: {
          tarball: "https://registry.npmjs.org/archive",
          integrity: "sha512-" + createHash("sha512").update(archive).digest("base64"),
        },
      },
    },
    "dist-tags": { latest: "1.2.0" },
  };
  let tag: any = null,
    release: any = null;
  let failRelease = false;
  const writes: any[] = [];
  const fetch = async (url: string) =>
    new Response(
      url.endsWith("/archive")
        ? archive
        : JSON.stringify(
            url.includes("/attestations/")
              ? {
                  attestations: [
                    {
                      predicateType: "https://slsa.dev/provenance/v1",
                      bundle: {
                        dsseEnvelope: {
                          payload: Buffer.from(JSON.stringify(statement)).toString("base64"),
                        },
                      },
                    },
                  ],
                }
              : registry,
          ),
    );
  const github = async (method: string, path: string, data?: any) => {
    if (method === "GET") {
      if (path.includes("package.json"))
        return { content: Buffer.from('{"version":"1.2.0"}').toString("base64") };
      if (path.includes("/contents/"))
        return { content: Buffer.from("# Changes\n[guide](../guide.md)").toString("base64") };
      if (path.includes("/git/ref/")) return tag;
      return release;
    }
    writes.push({ path, data });
    if (path.endsWith("/git/refs")) return (tag = { object: { type: "commit", sha: data.sha } });
    if (failRelease) throw Error("GitHub unavailable");
    return (release = { html_url: "https://github.com/example/release", ...data });
  };
  return {
    sha,
    statement,
    registry,
    writes,
    fetch,
    github,
    setTag: (sha: string) => {
      tag = { object: { type: "commit", sha } };
    },
    fail: (value: boolean) => {
      failRelease = value;
    },
  };
}
it("公開元へ固定し、繰り返しても作り直さない", async () => {
  const f = fixture();
  await synchronizeRelease("1.2.0", f);
  expect(f.writes[0].data).toEqual({ ref: "refs/tags/v1.2.0", sha: f.sha });
  expect(f.writes[1].data.body).toContain("npmjs.com/package/extendscript-compat/v/1.2.0");
  expect(f.writes[1].data.body).toContain(`/blob/${f.sha}/docs/guide.md`);
  expect((await synchronizeRelease("1.2.0", f)).created).toBe(false);
  expect(f.writes).toHaveLength(2);
});
it("タグ作成後の障害からReleaseだけ再試行できる", async () => {
  const f = fixture();
  f.fail(true);
  await expect(synchronizeRelease("1.2.0", f)).rejects.toThrow("unavailable");
  f.fail(false);
  await synchronizeRelease("1.2.0", f);
  expect(f.writes.filter((x) => x.path.endsWith("/git/refs"))).toHaveLength(1);
});
it("別コミットの既存タグを移動しない", async () => {
  const f = fixture();
  f.setTag("a".repeat(40));
  await expect(synchronizeRelease("1.2.0", f)).rejects.toThrow("既存タグ");
  expect(f.writes).toEqual([]);
});
it.each(["digest", "source", "expected", "missing"])(
  "照合失敗時は書き込まない %s",
  async (kind) => {
    const f = fixture();
    if (kind === "digest") f.statement.subject[0].digest.sha512 = "bad";
    if (kind === "source")
      f.statement.predicate.buildDefinition.externalParameters.workflow.repository =
        "https://github.com/other/repo";
    if (kind === "missing") delete (f.registry.versions as any)["1.2.0"];
    await expect(
      synchronizeRelease("1.2.0", {
        ...f,
        expectedCommit: kind === "expected" ? "a".repeat(40) : undefined,
      }),
    ).rejects.toThrow();
    expect(f.writes).toEqual([]);
  },
);
