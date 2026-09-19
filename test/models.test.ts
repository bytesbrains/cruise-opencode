import { describe, expect, it } from "vitest";
import {
  microsToDollarsPerMtok,
  projectCruiseLiveModels,
} from "../src/models.js";

describe("microsToDollarsPerMtok", () => {
  it("converts Cruise micros to dollars per million tokens", () => {
    expect(microsToDollarsPerMtok(220_000)).toBe(0.22);
    expect(microsToDollarsPerMtok(0)).toBe(0);
    expect(microsToDollarsPerMtok("14000")).toBe(0.014);
    expect(microsToDollarsPerMtok(null)).toBeUndefined();
    expect(microsToDollarsPerMtok(-1)).toBeUndefined();
  });
});

describe("projectCruiseLiveModels", () => {
  it("maps chat models and lanes from x-cruise metadata", () => {
    const models = projectCruiseLiveModels([
      {
        id: "deepseek/deepseek-v4-flash",
        object: "model",
        "x-cruise": {
          modality: "chat",
          tools: true,
          vision: null,
          max_context: 1_000_000,
          max_output: 384_000,
          pricing: {
            input_micros_per_mtok: 220_000,
            output_micros_per_mtok: 660_000,
            cached_input_micros_per_mtok: 7_000,
          },
        },
      },
      {
        id: "bb/agentic-coding",
        object: "model",
        "x-cruise": {
          lane: true,
          job: "agentic-coding",
          description: "Agent loops that write and repair code.",
          modality: "chat",
          tools: true,
          vision: false,
          max_context: 262_144,
          max_output: 64_000,
          pricing: {
            input_micros_per_mtok: 440_000,
            output_micros_per_mtok: 1_320_000,
            cached_input_micros_per_mtok: 14_000,
          },
        },
      },
      {
        id: "some/image-model",
        object: "model",
        "x-cruise": {
          modality: "image",
          max_context: 1,
          max_output: 1,
          pricing: {
            input_micros_per_mtok: 0,
            output_micros_per_mtok: 0,
            cached_input_micros_per_mtok: null,
          },
        },
      },
    ]);

    expect(Object.keys(models)).toEqual([
      "deepseek/deepseek-v4-flash",
      "bb/agentic-coding",
    ]);

    const flash = models["deepseek/deepseek-v4-flash"]!;
    expect(flash.cost).toEqual({
      input: 0.22,
      output: 0.66,
      cache_read: 0.007,
      cache_write: 0,
    });
    expect(flash.limit).toEqual({ context: 1_000_000, output: 384_000 });
    expect(flash.modalities?.input).toEqual(["text"]);
    expect(flash.tool_call).toBe(true);

    const lane = models["bb/agentic-coding"]!;
    expect(lane.name).toBe("Agent loops that write and repair code.");
    expect(lane.reasoning).toBe(true);
    expect(lane.cost?.input).toBe(0.44);
    expect(lane.limit?.context).toBe(262_144);
  });

  it("drops rows without x-cruise (no frozen catalogue)", () => {
    const models = projectCruiseLiveModels([
      { id: "unknown/no-meta", object: "model" },
      {
        id: "bb/chat-assistant",
        object: "model",
        "x-cruise": {
          lane: true,
          job: "chat-assistant",
          modality: "chat",
          max_context: 128_000,
          max_output: 8_192,
          pricing: {
            input_micros_per_mtok: 1_000,
            output_micros_per_mtok: 2_000,
          },
        },
      },
    ]);
    expect(Object.keys(models)).toEqual(["bb/chat-assistant"]);
    expect(models["bb/chat-assistant"]!.reasoning).toBe(false);
  });

  it("requires modality chat when x-cruise is present", () => {
    const models = projectCruiseLiveModels([
      {
        id: "mystery/no-modality",
        object: "model",
        "x-cruise": {
          tools: true,
          max_context: 128_000,
          pricing: { input_micros_per_mtok: 1, output_micros_per_mtok: 1 },
        },
      },
    ]);
    expect(models).toEqual({});
  });

  it("trims live ids and keeps last duplicate", () => {
    const models = projectCruiseLiveModels([
      {
        id: "  dup/model  ",
        object: "model",
        "x-cruise": {
          modality: "chat",
          max_context: 1_000,
          max_output: 100,
          pricing: {
            input_micros_per_mtok: 1_000_000,
            output_micros_per_mtok: 1_000_000,
          },
        },
      },
      {
        id: "dup/model",
        object: "model",
        "x-cruise": {
          modality: "chat",
          max_context: 2_000,
          max_output: 200,
          pricing: {
            input_micros_per_mtok: 2_000_000,
            output_micros_per_mtok: 2_000_000,
          },
        },
      },
    ]);
    expect(Object.keys(models)).toEqual(["dup/model"]);
    expect(models["dup/model"]!.limit?.context).toBe(2_000);
    expect(models["dup/model"]!.cost?.input).toBe(2);
  });
});
