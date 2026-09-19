import { CRUISE_BASE_URL, CRUISE_DEMO_BASE_URL } from "./constants.js";

/** Hosts the plugin will send traffic to (SSRF-safe explicit allowlist). */
const ALLOWED_HOSTS = new Set([
  new URL(CRUISE_BASE_URL).hostname,
  new URL(CRUISE_DEMO_BASE_URL).hostname,
]);

/**
 * Only the documented production and demo Cruise HTTPS hosts.
 * Rejects other hosts (including other `*.bytesbrains.net` names) so a
 * tampered config cannot SSRF with the presented key.
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
    if (!ALLOWED_HOSTS.has(host)) {
      return CRUISE_BASE_URL;
    }
    return candidate.replace(/\/+$/, "");
  } catch {
    return CRUISE_BASE_URL;
  }
}
