import type { Config } from "@opencode-ai/plugin";
import { resolveAllowedCruiseBaseUrl } from "./base-url.js";
import {
  CRUISE_API_KEY_ENV,
  CRUISE_BASE_URL,
  CRUISE_BASE_URL_ENV,
  OPENAI_COMPATIBLE_NPM,
  PROVIDER_ID,
} from "./constants.js";
import { fetchCruiseModels } from "./fetch-models.js";
import type { OpenCodeModelConfig } from "./models.js";

type ProviderEntry = NonNullable<Config["provider"]>[string];

export type ApplyCruiseProviderOptions = {
  /** Env-like map; defaults to `process.env`. */
  env?: Record<string, string | undefined>;
  /** Resolved Cruise key (env or `/connect` auth store). */
  apiKey?: string;
  fetchImpl?: typeof fetch;
  /** When false, skip live discovery (register provider shell only). */
  fetchModels?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Registers Cruise as an OpenAI-compatible OpenCode provider and, when a key
 * is present, fills `models` from live `GET /v1/models`.
 *
 * Mutates `config` in place (OpenCode plugin `config` hook contract).
 */
export async function applyCruiseProvider(
  config: Config,
  options: ApplyCruiseProviderOptions = {},
): Promise<{ fetched: boolean; modelCount: number; fetchError?: string }> {
  const env = options.env ?? process.env;
  const existing = asRecord(config.provider?.[PROVIDER_ID]) as ProviderEntry &
    Record<string, unknown>;
  const existingOptions = asRecord(existing.options);
  const existingModels = asRecord(existing.models) as Record<string, OpenCodeModelConfig>;

  const configuredBase =
    typeof existingOptions.baseURL === "string"
      ? existingOptions.baseURL
      : typeof env[CRUISE_BASE_URL_ENV] === "string"
        ? env[CRUISE_BASE_URL_ENV]
        : CRUISE_BASE_URL;
  const baseURL = resolveAllowedCruiseBaseUrl(configuredBase);

  const apiKey = (options.apiKey ?? env[CRUISE_API_KEY_ENV] ?? "").trim();

  config.provider ??= {};
  config.provider[PROVIDER_ID] = {
    ...existing,
    npm: typeof existing.npm === "string" ? existing.npm : OPENAI_COMPATIBLE_NPM,
    name: typeof existing.name === "string" ? existing.name : "BytesBrains Cruise",
    env: Array.isArray(existing.env) ? existing.env : [CRUISE_API_KEY_ENV],
    options: {
      ...existingOptions,
      baseURL,
      // Prefer env /connect; keep an explicit {env:} so recipes work without /connect.
      apiKey:
        typeof existingOptions.apiKey === "string"
          ? existingOptions.apiKey
          : `{env:${CRUISE_API_KEY_ENV}}`,
    },
    models: { ...existingModels },
  };

  if (options.fetchModels === false || !apiKey) {
    return { fetched: false, modelCount: Object.keys(existingModels).length };
  }

  const result = await fetchCruiseModels({
    baseUrl: baseURL,
    apiKey,
    fetchImpl: options.fetchImpl,
  });

  if (!result.ok) {
    return {
      fetched: false,
      modelCount: Object.keys(config.provider[PROVIDER_ID].models ?? {}).length,
      fetchError: result.reason,
    };
  }

  // Live catalogue first; user-authored model overrides win on id conflict.
  config.provider[PROVIDER_ID].models = {
    ...result.models,
    ...existingModels,
  };

  return {
    fetched: true,
    modelCount: Object.keys(config.provider[PROVIDER_ID].models ?? {}).length,
  };
}
