import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertReleaseVersion, verifyPublishedPackage } from "../scripts/npm-release.mjs";

const registry = {
  versions: { "0.3.0": {}, "0.3.1": {} },
  "dist-tags": { latest: "0.3.1" },
};

describe("手動公開の版番号確認", () => {
  it.each(["0.3.2", "0.4.0", "1.0.0", "0.10.0"])(
    "新しい正式版 %s を公開対象にできる",
    (version) => {
      expect(() => assertReleaseVersion(version, version, registry)).not.toThrow();
    },
  );
  it("入力と梱包元の版が異なる場合は公開を止める", () => {
    expect(() => assertReleaseVersion("0.3.2", "0.3.3", registry)).toThrow("一致しません");
  });
  it("既存版の再公開を止める", () => {
    expect(() => assertReleaseVersion("0.3.1", "0.3.1", registry)).toThrow("既に公開");
  });
  it.each(["0.2.9", "0.3.0"])("未公開でもlatestより古い %s を拒否する", (version) => {
    expect(() => assertReleaseVersion(version, version, { ...registry, versions: {} })).toThrow(
      "より新しい版",
    );
  });
  it.each(["0.3.2-beta.1", "0.3.2+build", "v0.3.2", "0.03.2", "0.3.2\n"])(
    "正式版以外の %j を拒否する",
    (version) => {
      expect(() => assertReleaseVersion(version, version, registry)).toThrow("正式版");
    },
  );
});

describe("公開済み配布物の確認", () => {
  const tarball = Buffer.from("検証済みの配布物");
  const integrity = "sha512-" + createHash("sha512").update(tarball).digest("base64");
  const published = {
    versions: {
      "0.3.2": {
        dist: { integrity, tarball: "https://registry.npmjs.org/example/-/example-0.3.2.tgz" },
      },
    },
    "dist-tags": { latest: "0.3.2" },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("版とlatestの反映を待ってから配布物を照合する", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json(registry))
      .mockResolvedValueOnce(Response.json({ ...published, "dist-tags": { latest: "0.3.1" } }))
      .mockResolvedValueOnce(Response.json(published))
      .mockResolvedValueOnce(new Response(tarball));

    const result = verifyPublishedPackage("example", "0.3.2", tarball);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe(integrity);
  });

  it("反映されなければ待機期限で失敗する", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(registry));
    const result = expect(verifyPublishedPackage("example", "0.3.2", tarball)).rejects.toThrow(
      "同じ版を再公開せず",
    );
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    await result;
  });

  it("登録されたハッシュが異なる場合はlatestを待たずに失敗する", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        ...published,
        versions: { "0.3.2": { dist: { integrity: "sha512-different" } } },
        "dist-tags": { latest: "0.3.1" },
      }),
    );
    await expect(verifyPublishedPackage("example", "0.3.2", tarball)).rejects.toThrow(
      "dist.integrityと検証済み配布物が一致しません",
    );
  });

  it("取得した配布物が異なる場合は失敗する", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json(published))
      .mockResolvedValueOnce(new Response("別の配布物"));
    await expect(verifyPublishedPackage("example", "0.3.2", tarball)).rejects.toThrow(
      "npmから取得した配布物が検証済み配布物と一致しません",
    );
  });

  it("照会エラーを未反映と扱わずに失敗する", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));
    await expect(verifyPublishedPackage("example", "0.3.2", tarball)).rejects.toThrow("HTTP 503");
  });
});
