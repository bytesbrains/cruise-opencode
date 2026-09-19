import { describe, expect, it } from "vitest";
import {
  ALLOWED_TOP,
  FORBIDDEN_NAME,
  assertSafeTarballName,
  gitleaksRequired,
  topLevelSegment,
} from "../scripts/pack-check-helpers.mjs";

describe("assertSafeTarballName", () => {
  it("accepts the npm pack basename for this package", () => {
    expect(assertSafeTarballName("bytesbrains-opencode-cruise-0.1.0.tgz")).toBe(
      "bytesbrains-opencode-cruise-0.1.0.tgz",
    );
  });

  it("rejects leading '-' (option-injection shape)", () => {
    expect(() => assertSafeTarballName("-oops.tgz")).toThrow(/starting with/);
  });

  it("rejects path separators and ..", () => {
    expect(() => assertSafeTarballName("../x.tgz")).toThrow(/unsafe/);
    expect(() => assertSafeTarballName("dir/x.tgz")).toThrow(/unsafe/);
  });
});

describe("topLevelSegment", () => {
  it("uses the first path segment; strips a defensive ./ prefix", () => {
    expect(topLevelSegment("dist/index.js")).toBe("dist");
    expect(topLevelSegment("./dist/index.js")).toBe("dist");
    expect(topLevelSegment("package.json")).toBe("package.json");
    expect(ALLOWED_TOP.has(topLevelSegment("dist/index.js"))).toBe(true);
    expect(ALLOWED_TOP.has(topLevelSegment(".npmrc"))).toBe(false);
  });
});

describe("FORBIDDEN_NAME", () => {
  it("catches nested secret-shaped names under an allowed top", () => {
    expect(FORBIDDEN_NAME.test("dist/.env")).toBe(true);
    expect(FORBIDDEN_NAME.test("dist/secret.pem")).toBe(true);
    expect(FORBIDDEN_NAME.test("dist/index.js")).toBe(false);
  });
});

describe("gitleaksRequired", () => {
  it("fails closed in CI / GitHub Actions", () => {
    expect(gitleaksRequired({ GITHUB_ACTIONS: "true" })).toBe(true);
    expect(gitleaksRequired({ CI: "true" })).toBe(true);
    expect(gitleaksRequired({})).toBe(false);
  });
});
