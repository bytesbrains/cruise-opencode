import { describe, expect, it, vi } from "vitest";
import { resolveCruiseApiKey } from "../src/resolve-api-key.js";
import { CRUISE_API_KEY_ENV } from "../src/constants.js";

describe("resolveCruiseApiKey", () => {
  it("prefers an explicit apiKey over env and auth store", async () => {
    const key = await resolveCruiseApiKey({
      apiKey: "cru_explicit",
      env: { [CRUISE_API_KEY_ENV]: "cru_env" },
      readFileImpl: async () => JSON.stringify({ cruise: { type: "api", key: "cru_store" } }),
    });
    expect(key).toBe("cru_explicit");
  });

  it("uses CRUISE_API_KEY from env when present", async () => {
    const key = await resolveCruiseApiKey({
      env: { [CRUISE_API_KEY_ENV]: "cru_from_env" },
      readFileImpl: async () => {
        throw new Error("should not read auth store");
      },
    });
    expect(key).toBe("cru_from_env");
  });

  it("falls back to OpenCode auth.json for provider cruise", async () => {
    const readFileImpl = vi.fn(async () =>
      JSON.stringify({
        cruise: { type: "api", key: "cru_from_connect" },
        other: { type: "api", key: "ignored" },
      }),
    );
    const key = await resolveCruiseApiKey({
      env: {},
      stateDir: "/tmp/opencode-state",
      readFileImpl,
    });
    expect(key).toBe("cru_from_connect");
    expect(readFileImpl).toHaveBeenCalledWith("/tmp/opencode-state/auth.json", "utf8");
  });

  it("returns undefined when neither env nor auth store has a key", async () => {
    const key = await resolveCruiseApiKey({
      env: {},
      stateDir: "/tmp/missing",
      readFileImpl: async () => {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      },
    });
    expect(key).toBeUndefined();
  });
});
