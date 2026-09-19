import { describe, expect, it, vi } from "vitest";
import type { Config } from "@opencode-ai/plugin";
import { applyCruiseProvider } from "../src/provider.js";
import {
  CRUISE_API_KEY_ENV,
  CRUISE_BASE_URL,
  CRUISE_DEMO_BASE_URL,
  OPENAI_COMPATIBLE_NPM,
  PROVIDER_ID,
} from "../src/constants.js";

describe("applyCruiseProvider", () => {
  it("registers the openai-compatible Cruise provider shell without a key", async () => {
    const config: Config = {};
    const result = await applyCruiseProvider(config, {
      env: {},
      fetchModels: true,
    });

    expect(result.fetched).toBe(false);
    expect(config.provider?.[PROVIDER_ID]).toMatchObject({
      npm: OPENAI_COMPATIBLE_NPM,
      name: "BytesBrains Cruise",
      env: [CRUISE_API_KEY_ENV],
      options: {
        baseURL: CRUISE_BASE_URL,
        apiKey: `{env:${CRUISE_API_KEY_ENV}}`,
      },
    });
    expect(config.provider?.[PROVIDER_ID]?.models).toEqual({});
  });

  it("fetches live models when an apiKey option is passed (auth-store path)", async () => {
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
              modality: "chat",
              max_context: 128_000,
              max_output: 8_192,
              pricing: {
                input_micros_per_mtok: 100_000,
                output_micros_per_mtok: 200_000,
              },
            },
          },
        ],
      }),
    );

    const config: Config = {};
    const result = await applyCruiseProvider(config, {
      env: {},
      apiKey: "cru_demo_testplaceholder00000000000000000000",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.fetched).toBe(true);
    expect(result.modelCount).toBe(1);
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("fetches live models when CRUISE_API_KEY is set", async () => {
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
              modality: "chat",
              max_context: 128_000,
              max_output: 8_192,
              pricing: {
                input_micros_per_mtok: 100_000,
                output_micros_per_mtok: 200_000,
              },
            },
          },
        ],
      }),
    );

    const config: Config = {};
    const result = await applyCruiseProvider(config, {
      env: {
        [CRUISE_API_KEY_ENV]: "cru_demo_testplaceholder00000000000000000000",
        CRUISE_BASE_URL: CRUISE_DEMO_BASE_URL,
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.fetched).toBe(true);
    expect(result.modelCount).toBe(1);
    expect(config.provider?.[PROVIDER_ID]?.options?.baseURL).toBe(CRUISE_DEMO_BASE_URL);
    expect(config.provider?.[PROVIDER_ID]?.models?.["bb/agentic-coding"]?.reasoning).toBe(true);
  });

  it("lets user-authored model entries win over live ids", async () => {
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
              modality: "chat",
              description: "live name",
              max_context: 1,
              max_output: 1,
              pricing: { input_micros_per_mtok: 1, output_micros_per_mtok: 1 },
            },
          },
        ],
      }),
    );

    const config: Config = {
      provider: {
        [PROVIDER_ID]: {
          models: {
            "bb/agentic-coding": { name: "user override" },
          },
        },
      },
    };

    await applyCruiseProvider(config, {
      env: { [CRUISE_API_KEY_ENV]: "cru_demo_testplaceholder00000000000000000000" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(config.provider?.[PROVIDER_ID]?.models?.["bb/agentic-coding"]?.name).toBe(
      "user override",
    );
  });
});
