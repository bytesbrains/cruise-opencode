import { MODELS_FETCH_TIMEOUT_MS } from "./constants.js";
import { projectCruiseLiveModels, type OpenCodeModelConfig } from "./models.js";
import { readCruiseErrorCode } from "./errors.js";

export type FetchCruiseModelsOptions = {
  baseUrl: string;
  apiKey: string;
  /** Injectable for tests. Defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type FetchCruiseModelsResult =
  | { ok: true; models: Record<string, OpenCodeModelConfig> }
  | { ok: false; reason: string; code?: string; status?: number };

/**
 * `GET {baseUrl}/models` with the presented Cruise key.
 * `baseUrl` must already include `/v1` (production/demo defaults do).
 */
export async function fetchCruiseModels(
  options: FetchCruiseModelsOptions,
): Promise<FetchCruiseModelsResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? MODELS_FETCH_TIMEOUT_MS;
  const url = `${options.baseUrl.replace(/\/+$/, "")}/models`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }

    if (!response.ok) {
      const code = readCruiseErrorCode(body);
      return {
        ok: false,
        reason: code
          ? `Cruise refused models list (${code})`
          : `Cruise models list failed with HTTP ${response.status}`,
        code,
        status: response.status,
      };
    }

    const data =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as { data?: unknown }).data
        : undefined;
    if (!Array.isArray(data)) {
      return { ok: false, reason: "Cruise models response missing data array", status: response.status };
    }

    return { ok: true, models: projectCruiseLiveModels(data) };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? `Cruise models list timed out after ${timeoutMs}ms`
          : error.message
        : String(error);
    return { ok: false, reason: message };
  } finally {
    clearTimeout(timer);
  }
}
