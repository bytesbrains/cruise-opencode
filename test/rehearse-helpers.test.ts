import { describe, expect, it } from "vitest";
import {
  isCruiseRefusal,
  readCruiseErrorCode,
} from "../src/errors.js";
import {
  classifyToolsHttpFailure,
  flushSseBuffer,
  sseIncompleteReason,
} from "../scripts/rehearse-helpers.mjs";

const refusal = { readCruiseErrorCode, isCruiseRefusal };

describe("classifyToolsHttpFailure", () => {
  it("hard-fails known Cruise refusals even on HTTP 400/422", () => {
    const body = { error: { code: "budget_exhausted", message: "cap" } };
    expect(classifyToolsHttpFailure(400, body, refusal)).toEqual({
      kind: "fail",
      message: expect.stringContaining("budget_exhausted"),
    });
    expect(classifyToolsHttpFailure(422, body, refusal).kind).toBe("fail");
  });

  it("soft-skips tool rejection without a Cruise refusal code", () => {
    expect(
      classifyToolsHttpFailure(400, { error: { message: "tools unsupported" } }, refusal),
    ).toEqual({
      kind: "soft_skip",
      reason: "tools request returned HTTP 400",
    });
    expect(
      classifyToolsHttpFailure(422, { error: { code: "tools_not_supported" } }, refusal),
    ).toEqual({
      kind: "soft_skip",
      reason: "tools request returned HTTP 422 (tools_not_supported)",
    });
  });

  it("hard-fails other HTTP statuses", () => {
    expect(classifyToolsHttpFailure(500, { error: { message: "boom" } }, refusal).kind).toBe(
      "fail",
    );
  });
});

describe("sseIncompleteReason", () => {
  it("requires [DONE] even when data frames arrived", () => {
    expect(sseIncompleteReason({ sawData: true, sawDone: false })).toMatch(/\[DONE\]/);
    expect(sseIncompleteReason({ sawData: false, sawDone: false })).toMatch(/no SSE/);
    expect(sseIncompleteReason({ sawData: true, sawDone: true })).toBeUndefined();
  });
});

describe("flushSseBuffer", () => {
  it("parses a trailing data line without a newline", () => {
    const lines: string[] = [];
    flushSseBuffer('data: {"choices":[{"delta":{"content":"x"}}]}', (line) =>
      lines.push(line),
    );
    expect(lines).toEqual(['data: {"choices":[{"delta":{"content":"x"}}]}']);
    flushSseBuffer("   ", (line) => lines.push(line));
    expect(lines).toHaveLength(1);
  });
});
