/**
 * BytesBrains Cruise — OpenCode plugin entry.
 *
 * Provider registration and live `GET /v1/models` fetch land in a follow-up
 * (#2). This scaffold exports a loadable OpenCode `Plugin` so the package can
 * be referenced from `opencode.json` once published.
 */
import type { Plugin } from "@opencode-ai/plugin";

/** Stable id for diagnostics and future provider registration. */
export const PLUGIN_ID = "bytesbrains-cruise";

/** Production Cruise OpenAI-compatible base URL (includes `/v1`). */
export const CRUISE_BASE_URL = "https://cruise.bytesbrains.net/v1";

/** Demo Cruise base URL for rehearsal with `cru_demo_` keys. */
export const CRUISE_DEMO_BASE_URL = "https://cruise-demo.bytesbrains.net/v1";

/** Environment variable OpenCode / users should set for the Cruise key. */
export const CRUISE_API_KEY_ENV = "CRUISE_API_KEY";

/** Optional override for the Cruise base URL. */
export const CRUISE_BASE_URL_ENV = "CRUISE_BASE_URL";

/**
 * OpenCode plugin. Currently a no-op hooks object — wiring Cruise as a
 * provider is intentionally deferred to issue #2.
 */
export const CruisePlugin: Plugin = async () => {
  return {};
};

export default CruisePlugin;
