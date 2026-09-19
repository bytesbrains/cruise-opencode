import { homedir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { CRUISE_API_KEY_ENV, PROVIDER_ID } from "./constants.js";

export type ResolveCruiseApiKeyOptions = {
  env?: Record<string, string | undefined>;
  /** Explicit key (tests / callers that already resolved auth). */
  apiKey?: string;
  /** OpenCode state directory (contains `auth.json`). */
  stateDir?: string;
  /** Injectable read for tests. */
  readFileImpl?: (path: string, encoding: "utf8") => Promise<string>;
};

/**
 * Resolves a Cruise API key for live `GET /v1/models`.
 * Prefer env (`CRUISE_API_KEY`); fall back to OpenCode `/connect` auth store.
 */
export async function resolveCruiseApiKey(
  options: ResolveCruiseApiKeyOptions = {},
): Promise<string | undefined> {
  const explicit = options.apiKey?.trim();
  if (explicit) {
    return explicit;
  }

  const env = options.env ?? process.env;
  const fromEnv = env[CRUISE_API_KEY_ENV]?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const stateDir =
    options.stateDir?.trim() ||
    join(homedir(), ".local", "share", "opencode");
  const authPath = join(stateDir, "auth.json");
  const read = options.readFileImpl ?? ((path, encoding) => readFile(path, encoding));

  try {
    const raw = await read(authPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    const entry = (parsed as Record<string, unknown>)[PROVIDER_ID];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return undefined;
    }
    const auth = entry as { type?: unknown; key?: unknown };
    if (auth.type === "api" && typeof auth.key === "string" && auth.key.trim()) {
      return auth.key.trim();
    }
  } catch {
    return undefined;
  }
  return undefined;
}
