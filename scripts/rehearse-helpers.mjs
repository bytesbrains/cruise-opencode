/**
 * Pure helpers for scripts/rehearse-demo.mjs — kept separate so vitest can
 * import them without running the network rehearsal.
 */

/**
 * Classify a non-OK tools chat response.
 * Soft-skip only when the demo rejects tools without a known Cruise refusal
 * code; known refusals (budget_exhausted, …) are hard failures.
 *
 * @param {number} status
 * @param {unknown} body
 * @param {{ readCruiseErrorCode: (p: unknown) => string | undefined, isCruiseRefusal: (p: unknown) => boolean }} refusal
 * @returns {{ kind: "soft_skip", reason: string } | { kind: "fail", message: string }}
 */
export function classifyToolsHttpFailure(status, body, refusal) {
  const code = refusal.readCruiseErrorCode(body);
  if (refusal.isCruiseRefusal(body)) {
    return {
      kind: "fail",
      message: `tools chat refused (${code}) — ${JSON.stringify(body ?? {})}`,
    };
  }
  if (status === 400 || status === 422) {
    return {
      kind: "soft_skip",
      reason: `tools request returned HTTP ${status}${code ? ` (${code})` : ""}`,
    };
  }
  return {
    kind: "fail",
    message: `tools chat HTTP ${status}${code ? ` (${code})` : ""} — ${JSON.stringify(body ?? {})}`,
  };
}

/**
 * Flush a trailing SSE buffer fragment that lacked a terminating newline.
 * @param {string} buffer
 * @param {(line: string) => void} onLine
 */
export function flushSseBuffer(buffer, onLine) {
  const trimmed = buffer.trim();
  if (trimmed) onLine(trimmed);
}

/**
 * Require a completed SSE stream: must have seen `data: [DONE]`.
 * @param {{ sawData: boolean, sawDone: boolean }} state
 * @returns {string | undefined} failure message, or undefined when ok
 */
export function sseIncompleteReason(state) {
  if (state.sawDone) return undefined;
  if (state.sawData) {
    return "streamed chat ended without [DONE] terminator";
  }
  return "streamed chat produced no SSE data frames";
}
