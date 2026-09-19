import { resolveAllowedCruiseBaseUrl } from "./base-url.js";
import { CRUISE_BASE_URL } from "./constants.js";

/**
 * Map an allowed Cruise `/v1` base URL to the MCP endpoint (`…/mcp`).
 * Always goes through the same host allowlist as inference traffic.
 */
export function resolveCruiseMcpUrl(baseUrl?: string): string {
  const allowed = resolveAllowedCruiseBaseUrl(baseUrl ?? CRUISE_BASE_URL);
  try {
    const url = new URL(allowed);
    // Inference bases end in `/v1`; MCP is `/mcp` on the same host.
    const path = url.pathname.replace(/\/+$/, "").replace(/\/v1$/, "");
    url.pathname = `${path}/mcp`.replace(/\/{2,}/g, "/");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "https://cruise.bytesbrains.net/mcp";
  }
}
