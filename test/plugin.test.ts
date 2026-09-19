import { describe, expect, it, vi } from "vitest";
import CruisePlugin, {
  CRUISE_API_KEY_ENV,
  CRUISE_BASE_URL,
  CRUISE_BASE_URL_ENV,
  CRUISE_DEMO_BASE_URL,
  CRUISE_DEFAULT_MODEL_ID,
  CruisePlugin as NamedCruisePlugin,
  PLUGIN_ID,
  PROVIDER_ID,
} from "../src/index.js";
import type { Config } from "@opencode-ai/plugin";

function fakeClient() {
  return {
    app: {
      log: vi.fn(async () => ({})),
    },
  };
}

describe("package exports", () => {
  it("exposes stable ids and public Cruise endpoints", () => {
    expect(PLUGIN_ID).toBe("bytesbrains-cruise");
    expect(PROVIDER_ID).toBe("cruise");
    expect(CRUISE_BASE_URL).toBe("https://cruise.bytesbrains.net/v1");
    expect(CRUISE_DEMO_BASE_URL).toBe("https://cruise-demo.bytesbrains.net/v1");
    expect(CRUISE_API_KEY_ENV).toBe("CRUISE_API_KEY");
    expect(CRUISE_BASE_URL_ENV).toBe("CRUISE_BASE_URL");
    expect(CRUISE_DEFAULT_MODEL_ID).toBe("bb/agentic-coding");
  });

  it("default-exports the same Plugin as the named export", () => {
    expect(CruisePlugin).toBe(NamedCruisePlugin);
    expect(typeof CruisePlugin).toBe("function");
  });
});

describe("CruisePlugin", () => {
  it("returns auth + config hooks and registers the Cruise provider", async () => {
    const hooks = await CruisePlugin({ client: fakeClient() } as never);
    expect(hooks.auth?.provider).toBe("cruise");
    expect(typeof hooks.config).toBe("function");

    const config: Config = {};
    await hooks.config?.(config);
    expect(config.provider?.cruise?.npm).toBe("@ai-sdk/openai-compatible");
    expect(config.provider?.cruise?.options?.baseURL).toBe(CRUISE_BASE_URL);
  });
});
