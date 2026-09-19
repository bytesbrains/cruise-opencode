/**
 * Thin JSON-RPC client for Cruise's remote MCP (`POST …/mcp`).
 * Same wire the Claude/Cursor plugins use; read-only tools only.
 */

export const MCP_FETCH_TIMEOUT_MS = 10_000;

export type CallCruiseMcpToolOptions = {
  mcpUrl: string;
  apiKey: string;
  name: string;
  arguments?: Record<string, unknown>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type CallCruiseMcpToolResult =
  | { ok: true; text: string; structured?: unknown }
  | { ok: false; reason: string };

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function textFromMcpResult(result: Record<string, unknown>): string {
  const content = result.content;
  if (Array.isArray(content)) {
    const parts = content
      .map((part) => {
        const row = asRecord(part);
        return row && row.type === "text" && typeof row.text === "string" ? row.text : "";
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join("\n");
  }
  if (result.structuredContent !== undefined) {
    return JSON.stringify(result.structuredContent, null, 2);
  }
  return JSON.stringify(result, null, 2);
}

/**
 * Call one Cruise MCP tool via JSON-RPC `tools/call`.
 * Never logs the API key.
 */
export async function callCruiseMcpTool(
  options: CallCruiseMcpToolOptions,
): Promise<CallCruiseMcpToolResult> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    return { ok: false, reason: "Cruise API key is missing" };
  }

  const timeoutMs = options.timeoutMs ?? MCP_FETCH_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(options.mcpUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: options.name,
          arguments: options.arguments ?? {},
        },
      }),
      signal: controller.signal,
    });

    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      return {
        ok: false,
        reason: `Cruise MCP HTTP ${response.status}${body ? ` — ${JSON.stringify(body)}` : ""}`,
      };
    }

    const root = asRecord(body);
    if (!root) {
      return { ok: false, reason: "Cruise MCP returned a non-object body" };
    }
    if (root.error) {
      return { ok: false, reason: `Cruise MCP error — ${JSON.stringify(root.error)}` };
    }
    const result = asRecord(root.result);
    if (!result) {
      return { ok: false, reason: "Cruise MCP response missing result" };
    }
    if (result.isError === true) {
      return { ok: false, reason: textFromMcpResult(result) };
    }
    return {
      ok: true,
      text: textFromMcpResult(result),
      structured: result.structuredContent,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `Cruise MCP request failed: ${message}` };
  } finally {
    clearTimeout(timer);
  }
}
