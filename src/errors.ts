/**
 * Cruise refusal helpers — branch on `error.code`, not HTTP status alone.
 */

/** Known Cruise gateway refusal codes (public product behaviour). */
export const CRUISE_REFUSAL_CODES = [
  "budget_exhausted",
  "wallet_exhausted",
  "measurement_stale",
  "model_not_found",
  "permission_error",
] as const;

export type CruiseRefusalCode = (typeof CRUISE_REFUSAL_CODES)[number];

const REFUSAL_SET = new Set<string>(CRUISE_REFUSAL_CODES);

/**
 * Reads `error.code` from a Cruise-shaped error payload (nested under `error`
 * or at the top level). Returns undefined when absent or not a string.
 */
export function readCruiseErrorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }
  const root = payload as Record<string, unknown>;
  const nested =
    root.error && typeof root.error === "object" && !Array.isArray(root.error)
      ? (root.error as Record<string, unknown>)
      : undefined;
  const code = nested?.code ?? root.code;
  return typeof code === "string" && code.trim() ? code.trim() : undefined;
}

/** True when the payload carries a known Cruise refusal `error.code`. */
export function isCruiseRefusal(payload: unknown): boolean {
  const code = readCruiseErrorCode(payload);
  return code !== undefined && REFUSAL_SET.has(code);
}
