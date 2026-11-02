import { describe, expect, it } from "vitest";
import { assertReleaseVersion } from "../scripts/npm-release.mjs";

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
