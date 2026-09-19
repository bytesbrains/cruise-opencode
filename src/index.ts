/**
 * BytesBrains Cruise — OpenCode plugin entry.
 *
 * Registers Cruise as an OpenAI-compatible provider (`@ai-sdk/openai-compatible`)
 * and fills models from live `GET /v1/models` when `CRUISE_API_KEY` is set.
 */
import type { Plugin } from "@opencode-ai/plugin";
import { cruiseAuthHook } from "./auth.js";
import { applyCruiseProvider } from "./provider.js";
import { isCruiseRefusal, readCruiseErrorCode } from "./errors.js";
import { PROVIDER_ID } from "./constants.js";

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
export {
  CRUISE_REFUSAL_CODES,
  isCruiseRefusal,
  readCruiseErrorCode,
  type CruiseRefusalCode,
} from "./errors.js";
export { cruiseAuthHook } from "./auth.js";

export const CruisePlugin: Plugin = async ({ client }) => {
  return {
    auth: cruiseAuthHook,
    config: async (config) => {
      const result = await applyCruiseProvider(config);
      if (result.fetchError) {
        await client.app.log({
          body: {
            service: PROVIDER_ID,
            level: "warn",
            message: result.fetchError,
          },
        }).catch(() => {
          /* logging is best-effort during config */
        });
      }
    },
    event: async ({ event }) => {
      if (event.type !== "session.error") {
        return;
      }
      const raw = event.properties.error;
      // AI SDK APIError often carries the Cruise JSON body as responseBody text.
      let payload: unknown = raw;
      if (raw && typeof raw === "object" && "data" in raw) {
        const data = (raw as { data?: { responseBody?: unknown } }).data;
        if (typeof data?.responseBody === "string") {
          try {
            payload = JSON.parse(data.responseBody);
          } catch {
            payload = data.responseBody;
          }
        }
      }
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
    },
  };
};

export default CruisePlugin;
