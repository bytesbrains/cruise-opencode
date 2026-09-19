import { CRUISE_BASE_URL } from "./constants.js";

/**
 * Only HTTPS hosts under `bytesbrains.net` (prod, demo, future enterprise).
 * Rejects loopback / private / arbitrary hosts so a tampered config cannot SSRF.
 * Invalid or disallowed values fall back to production.
 */
export function resolveAllowedCruiseBaseUrl(baseUrl?: string): string {
  const candidate = (baseUrl ?? "").trim() || CRUISE_BASE_URL;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") {
      return CRUISE_BASE_URL;
    }
    const host = url.hostname.toLowerCase();
    const allowed = host === "bytesbrains.net" || host.endsWith(".bytesbrains.net");
    if (!allowed) {
      return CRUISE_BASE_URL;
    }
    return candidate.replace(/\/+$/, "");
  } catch {
    return CRUISE_BASE_URL;
  }
}
