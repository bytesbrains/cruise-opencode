import { describe, expect, it } from "vitest";
import { resolveAllowedCruiseBaseUrl } from "../src/base-url.js";
import {
  CRUISE_BASE_URL,
  CRUISE_DEMO_BASE_URL,
} from "../src/constants.js";

describe("resolveAllowedCruiseBaseUrl", () => {
  it("allows production and demo HTTPS hosts", () => {
    expect(resolveAllowedCruiseBaseUrl(CRUISE_BASE_URL)).toBe(CRUISE_BASE_URL);
    expect(resolveAllowedCruiseBaseUrl(CRUISE_DEMO_BASE_URL)).toBe(CRUISE_DEMO_BASE_URL);
  });

  it("strips trailing slashes on allowed hosts", () => {
    expect(resolveAllowedCruiseBaseUrl(`${CRUISE_DEMO_BASE_URL}/`)).toBe(CRUISE_DEMO_BASE_URL);
  });

  it("rejects non-Cruise and non-HTTPS hosts", () => {
    expect(resolveAllowedCruiseBaseUrl("http://cruise.bytesbrains.net/v1")).toBe(CRUISE_BASE_URL);
    expect(resolveAllowedCruiseBaseUrl("https://169.254.169.254/")).toBe(CRUISE_BASE_URL);
    expect(resolveAllowedCruiseBaseUrl("https://evil.example/v1")).toBe(CRUISE_BASE_URL);
    expect(resolveAllowedCruiseBaseUrl("not a url")).toBe(CRUISE_BASE_URL);
  });
});
