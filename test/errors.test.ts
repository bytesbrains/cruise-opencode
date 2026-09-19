import { describe, expect, it } from "vitest";
import {
  isCruiseRefusal,
  readCruiseErrorCode,
} from "../src/errors.js";

describe("Cruise refusal helpers", () => {
  it("reads nested and top-level error.code", () => {
    expect(readCruiseErrorCode({ error: { code: "wallet_exhausted" } })).toBe(
      "wallet_exhausted",
    );
    expect(readCruiseErrorCode({ code: "measurement_stale" })).toBe("measurement_stale");
    expect(readCruiseErrorCode({ error: { message: "nope" } })).toBeUndefined();
  });

  it("recognises known Cruise refusal codes only", () => {
    expect(isCruiseRefusal({ error: { code: "budget_exhausted" } })).toBe(true);
    expect(isCruiseRefusal({ error: { code: "some_other_error" } })).toBe(false);
  });
});
