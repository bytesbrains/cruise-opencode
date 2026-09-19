/** Public Cruise endpoints, env names, and OpenCode provider id. */

/** OpenCode provider id (`opencode.json` / `/connect`). */
export const PROVIDER_ID = "cruise";

/** Stable plugin id for diagnostics. */
export const PLUGIN_ID = "bytesbrains-cruise";

/** Production Cruise OpenAI-compatible base URL (includes `/v1`). */
export const CRUISE_BASE_URL = "https://cruise.bytesbrains.net/v1";

/** Demo Cruise base URL for rehearsal with `cru_demo_` keys. */
export const CRUISE_DEMO_BASE_URL = "https://cruise-demo.bytesbrains.net/v1";

/** Environment variable for the Cruise API key. */
export const CRUISE_API_KEY_ENV = "CRUISE_API_KEY";

/** Optional override for the Cruise base URL. */
export const CRUISE_BASE_URL_ENV = "CRUISE_BASE_URL";

/** Default model id recommended in docs (a lane, not a pinned upstream id). */
export const CRUISE_DEFAULT_MODEL_ID = "bb/agentic-coding";

/** npm package OpenCode uses for `/v1/chat/completions`. */
export const OPENAI_COMPATIBLE_NPM = "@ai-sdk/openai-compatible";

/** How long to wait for `GET /v1/models` during plugin config. */
export const MODELS_FETCH_TIMEOUT_MS = 10_000;
