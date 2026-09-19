import { describe, expect, it, vi } from "vitest";
import { fetchCruiseModels } from "../src/fetch-models.js";
import { CRUISE_DEMO_BASE_URL } from "../src/constants.js";

describe("fetchCruiseModels", () => {
  it("projects models from a successful Cruise response", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        object: "list",
        data: [
          {
            id: "bb/agentic-coding",
            object: "model",
            "x-cruise": {
              lane: true,
              job: "agentic-coding",
              description: "Agent loops that write and repair code.",
              modality: "chat",
              tools: true,
              max_context: 262_144,
              max_output: 64_000,
              pricing: {
                input_micros_per_mtok: 440_000,
                output_micros_per_mtok: 1_320_000,
                cached_input_micros_per_mtok: 14_000,
              },
            },
          },
        ],
      }),
    );

    const result = await fetchCruiseModels({
      baseUrl: CRUISE_DEMO_BASE_URL,
      apiKey: "cru_demo_testplaceholder00000000000000000000",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(fetchImpl).toHaveBeenCalledWith(
      `${CRUISE_DEMO_BASE_URL}/models`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer cru_demo_testplaceholder00000000000000000000",
        }),
      }),
    );
    expect(Object.keys(result.models)).toEqual(["bb/agentic-coding"]);
  });

  it("surfaces Cruise refusal codes from failed responses", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        { error: { code: "budget_exhausted", message: "cap reached" } },
        { status: 429 },
      ),
    );

    const result = await fetchCruiseModels({
      baseUrl: CRUISE_DEMO_BASE_URL,
      apiKey: "cru_demo_testplaceholder00000000000000000000",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("budget_exhausted");
    expect(result.status).toBe(429);
    expect(result.reason).toContain("budget_exhausted");
  });
});
