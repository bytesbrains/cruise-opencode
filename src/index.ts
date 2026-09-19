/**
 * BytesBrains Cruise — OpenCode plugin entry.
 *
 * Registers Cruise as an OpenAI-compatible provider (`@ai-sdk/openai-compatible`)
 * and fills models from live `GET /v1/models` when a Cruise key is available
 * (env or OpenCode `/connect` auth store).
 */
import type { Config, Plugin, PluginInput } from "@opencode-ai/plugin";
import { cruiseAuthHook } from "./auth.js";
import { applyCruiseProvider } from "./provider.js";
import { isCruiseRefusal, readCruiseErrorCode } from "./errors.js";
import { resolveCruiseApiKey } from "./resolve-api-key.js";
import { PROVIDER_ID } from "./constants.js";
import { cruiseTools } from "./tools.js";

export {
  PLUGIN_ID,
  PROVIDER_ID,
  CRUISE_BASE_URL,
  CRUISE_DEMO_BASE_URL,
  CRUISE_API_KEY_ENV,
  CRUISE_BASE_URL_ENV,
  CRUISE_DEFAULT_MODEL_ID,
  OPENAI_COMPATIBLE_NPM,
} from "./constants.js";
export { resolveAllowedCruiseBaseUrl } from "./base-url.js";
export {
  microsToDollarsPerMtok,
  projectCruiseLiveModels,
  type OpenCodeModelConfig,
} from "./models.js";
export { fetchCruiseModels } from "./fetch-models.js";
export { applyCruiseProvider } from "./provider.js";
export { resolveCruiseApiKey } from "./resolve-api-key.js";
export {
  CRUISE_REFUSAL_CODES,
  isCruiseRefusal,
  readCruiseErrorCode,
  type CruiseRefusalCode,
} from "./errors.js";
export { cruiseAuthHook } from "./auth.js";
export { resolveCruiseMcpUrl } from "./mcp-url.js";
export { callCruiseMcpTool } from "./mcp-client.js";
export { applyCruiseMcp, cruiseTools, createCruiseTools } from "./tools.js";

async function resolveStateDir(client: PluginInput["client"]): Promise<string | undefined> {
  try {
    const result = await client.path.get();
    const data = "data" in result ? result.data : undefined;
    if (data && typeof data === "object" && "state" in data) {
      const state = (data as { state?: unknown }).state;
      return typeof state === "string" && state.trim() ? state.trim() : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function logWarn(client: PluginInput["client"], message: string): Promise<void> {
  await client.app
    .log({
      body: {
        service: PROVIDER_ID,
        level: "warn",
        message,
      },
    })
    .catch(() => {
      /* logging is best-effort during config */
    });
}

function cruisePayloadFromSessionError(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || !("data" in raw)) {
    return raw;
  }
  const data = (raw as { data?: { responseBody?: unknown } }).data;
  if (typeof data?.responseBody !== "string") {
    return raw;
  }
  try {
    return JSON.parse(data.responseBody);
  } catch {
    return data.responseBody;
  }
}

async function handleConfigHook(
  client: PluginInput["client"],
  config: Config,
): Promise<void> {
  const stateDir = await resolveStateDir(client);
  const apiKey = await resolveCruiseApiKey({ stateDir });
  const result = await applyCruiseProvider(config, { apiKey });
  if (result.fetchError) {
    await logWarn(client, result.fetchError);
  }
}

async function handleSessionError(
  client: PluginInput["client"],
  event: { type: string; properties?: Record<string, unknown> },
): Promise<void> {
  if (event.type !== "session.error") {
    return;
  }
  const payload = cruisePayloadFromSessionError(event.properties?.error);
  if (!isCruiseRefusal(payload)) {
    return;
  }
  const code = readCruiseErrorCode(payload);
  await client.app
    .log({
      body: {
        service: PROVIDER_ID,
        level: "error",
        message: `Cruise refused the request (${code}) — branch on error.code, not HTTP status alone`,
        extra: { code },
      },
    })
    .catch(() => {
      /* best-effort */
    });
}

export const CruisePlugin: Plugin = async ({ client }) => {
  return {
    auth: cruiseAuthHook,
    tool: cruiseTools,
    config: async (config) => {
      await handleConfigHook(client, config);
    },
    event: async ({ event }) => {
      await handleSessionError(client, event as { type: string; properties?: Record<string, unknown> });
    },
  };
};

export default CruisePlugin;
