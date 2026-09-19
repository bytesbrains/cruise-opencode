import { describe, expect, it } from "vitest";
import CruisePlugin, {
  CRUISE_API_KEY_ENV,
  CRUISE_BASE_URL,
  CRUISE_BASE_URL_ENV,
  CRUISE_DEMO_BASE_URL,
  CruisePlugin as NamedCruisePlugin,
  PLUGIN_ID,
} from "../src/index.js";

describe("package exports", () => {
  it("exposes a stable plugin id and public Cruise endpoints", () => {
    expect(PLUGIN_ID).toBe("bytesbrains-cruise");
    expect(CRUISE_BASE_URL).toBe("https://cruise.bytesbrains.net/v1");
    expect(CRUISE_DEMO_BASE_URL).toBe("https://cruise-demo.bytesbrains.net/v1");
    expect(CRUISE_API_KEY_ENV).toBe("CRUISE_API_KEY");
    expect(CRUISE_BASE_URL_ENV).toBe("CRUISE_BASE_URL");
  });

  it("default-exports the same Plugin as the named export", () => {
    expect(CruisePlugin).toBe(NamedCruisePlugin);
    expect(typeof CruisePlugin).toBe("function");
  });
});

describe("CruisePlugin", () => {
  it("loads and returns an empty hooks object (scaffold)", async () => {
    // OpenCode passes a PluginInput; the scaffold ignores it until #2.
    const hooks = await CruisePlugin({} as never);
    expect(hooks).toEqual({});
  });
});
