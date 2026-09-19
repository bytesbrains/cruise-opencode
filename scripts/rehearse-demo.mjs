#!/usr/bin/env node
/**
 * Rehearse OpenCode ↔ Cruise wiring against the **demo** host.
 *
 * Requires a `cru_demo_` key in the environment (never commit one):
 *
 *   export CRUISE_API_KEY=cru_demo_…
 *   export CRUISE_BASE_URL=https://cruise-demo.bytesbrains.net/v1   # optional
 *   npm run build && npm run rehearse:demo
 *
 * Checks:
 *   1. GET /v1/models → plugin projection surfaces chat / lane ids
 *   2. Streamed POST /v1/chat/completions completes; prints Cruise response headers
 *   3. Tool-bearing chat request is accepted (demo may fabricate the body)
 *   4. Cruise MCP `get_budget` (+ optional `list_models`) answers over `/mcp`
 *
 * Exit 0 on success. Never prints the API key.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CRUISE_API_KEY_ENV,
  CRUISE_BASE_URL_ENV,
  CRUISE_DEMO_BASE_URL,
  CRUISE_DEFAULT_MODEL_ID,
  fetchCruiseModels,
  projectCruiseLiveModels,
  resolveAllowedCruiseBaseUrl,
  readCruiseErrorCode,
  isCruiseRefusal,
  resolveCruiseMcpUrl,
  callCruiseMcpTool,
} from "../dist/index.js";
import {
  classifyToolsHttpFailure,
  flushSseBuffer,
  sseIncompleteReason,
} from "./rehearse-helpers.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const refusal = { readCruiseErrorCode, isCruiseRefusal };

function loadDotEnv() {
  const path = resolve(root, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function redactKey(key) {
  if (!key) return "(missing)";
  if (key.length <= 12) return `${key.slice(0, 4)}…`;
  return `${key.slice(0, 8)}…`;
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

function cruiseHeaders(response) {
  const interesting = [
    "x-cruise-model",
    "x-cruise-lane",
    "x-cruise-budget-state",
    "x-cruise-budget-spend",
    "x-cruise-budget-limit",
    "x-cruise-wallet-state",
    "x-cruise-wallet-balance",
    "x-cruise-cache",
  ];
  const out = {};
  for (const name of interesting) {
    const value = response.headers.get(name);
    if (value !== null) out[name] = value;
  }
  return out;
}

async function readErrorBody(response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function streamedChat({ baseUrl, apiKey, model }) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [{ role: "user", content: "Reply with the single word: pong" }],
      max_tokens: 32,
    }),
  });

  const headers = cruiseHeaders(response);
  if (!response.ok) {
    const body = await readErrorBody(response);
    const code = readCruiseErrorCode(body);
    fail(
      `streamed chat HTTP ${response.status}${code ? ` (${code})` : ""} — ${JSON.stringify(body ?? {})}`,
    );
  }

  if (!response.body) {
    fail("streamed chat returned no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawData = false;
  let sawDone = false;
  let content = "";

  const consumeLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice(5).trim();
    if (data === "[DONE]") {
      sawDone = true;
      return;
    }
    sawData = true;
    try {
      const chunk = JSON.parse(data);
      const delta = chunk?.choices?.[0]?.delta?.content;
      if (typeof delta === "string") content += delta;
    } catch {
      /* ignore non-JSON SSE comments */
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) consumeLine(line);
  }
  // Flush decoder + any final data: line that lacked a trailing newline.
  buffer += decoder.decode();
  flushSseBuffer(buffer, consumeLine);

  const incomplete = sseIncompleteReason({ sawData, sawDone });
  if (incomplete) fail(incomplete);

  return { headers, content, sawDone };
}

async function toolsChat({ baseUrl, apiKey, model }) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: "user", content: "Call the ping tool once." }],
      tools: [
        {
          type: "function",
          function: {
            name: "ping",
            description: "A no-op probe tool for wire rehearsal",
            parameters: {
              type: "object",
              properties: {
                note: { type: "string" },
              },
            },
          },
        },
      ],
      tool_choice: "auto",
      max_tokens: 64,
    }),
  });

  const headers = cruiseHeaders(response);
  const body = await readErrorBody(response);
  if (!response.ok) {
    // Soft-skip only when the demo rejects tools without a known Cruise
    // refusal code; budget_exhausted / measurement_stale / … must fail.
    const verdict = classifyToolsHttpFailure(response.status, body, refusal);
    if (verdict.kind === "soft_skip") {
      return {
        accepted: false,
        skipped: true,
        reason: verdict.reason,
        headers,
      };
    }
    fail(verdict.message);
  }

  return { accepted: true, skipped: false, headers, body };
}

async function main() {
  loadDotEnv();

  const apiKey = (process.env[CRUISE_API_KEY_ENV] ?? "").trim();
  if (!apiKey) {
    fail(
      `Set ${CRUISE_API_KEY_ENV} to a cru_demo_… key (see .env.example). Never commit the key.`,
    );
  }
  if (!apiKey.startsWith("cru_demo_") && !apiKey.startsWith("cru_")) {
    fail(`${CRUISE_API_KEY_ENV} does not look like a Cruise key (expected cru_…)`);
  }

  const baseUrl = resolveAllowedCruiseBaseUrl(
    process.env[CRUISE_BASE_URL_ENV] ?? CRUISE_DEMO_BASE_URL,
  );

  console.log("Cruise demo rehearsal");
  console.log(`  base URL : ${baseUrl}`);
  console.log(`  key      : ${redactKey(apiKey)}`);
  console.log("");

  // 1. Models list + plugin projection
  const modelsResult = await fetchCruiseModels({ baseUrl, apiKey });
  if (!modelsResult.ok) {
    fail(`GET /v1/models failed: ${modelsResult.reason}`);
  }
  const projected = modelsResult.models;
  const ids = Object.keys(projected);
  if (ids.length === 0) {
    fail("GET /v1/models returned no projectable chat models (x-cruise modality=chat)");
  }
  ok(`GET /v1/models → plugin projection: ${ids.length} model id(s)`);
  if (projected[CRUISE_DEFAULT_MODEL_ID]) {
    ok(`lane ${CRUISE_DEFAULT_MODEL_ID} present`);
  } else {
    console.log(`  note: preferred lane ${CRUISE_DEFAULT_MODEL_ID} not in this key's catalogue`);
  }
  console.log(`  sample ids: ${ids.slice(0, 5).join(", ")}${ids.length > 5 ? ", …" : ""}`);

  // Prefer a lane for chat; fall back to first projected id.
  const model =
    (projected[CRUISE_DEFAULT_MODEL_ID] && CRUISE_DEFAULT_MODEL_ID) ||
    ids.find((id) => id.startsWith("bb/")) ||
    ids[0];
  console.log(`  using model: ${model}`);
  console.log("");

  // Sanity: projection helper matches fetch result shape
  const rawProbe = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!rawProbe.ok) {
    fail(`raw GET /v1/models HTTP ${rawProbe.status}`);
  }
  const rawJson = await rawProbe.json();
  const rawProjected = projectCruiseLiveModels(rawJson.data ?? []);
  if (Object.keys(rawProjected).length !== ids.length) {
    fail("raw projection id count diverged from fetchCruiseModels");
  }
  ok("plugin projection matches raw GET /v1/models data[]");

  // 2. Streamed chat
  const stream = await streamedChat({ baseUrl, apiKey, model });
  ok(
    `streamed chat completed (sse done=${stream.sawDone}, content_chars=${stream.content.length})`,
  );
  if (Object.keys(stream.headers).length > 0) {
    console.log(`  cruise headers: ${JSON.stringify(stream.headers)}`);
  } else {
    console.log("  cruise headers: (none on this response — demo may omit ledger headers)");
  }
  console.log("");

  // 3. Tools (best-effort on demo)
  const tools = await toolsChat({ baseUrl, apiKey, model });
  if (tools.skipped) {
    console.log(`○ tools request skipped: ${tools.reason}`);
  } else {
    ok("tool-bearing chat request accepted");
    if (Object.keys(tools.headers).length > 0) {
      console.log(`  cruise headers: ${JSON.stringify(tools.headers)}`);
    }
  }
  console.log("");

  // 4. Cruise MCP (read-only budget tools)
  const mcpUrl = resolveCruiseMcpUrl(baseUrl);
  console.log(`  mcp URL : ${mcpUrl}`);
  const budget = await callCruiseMcpTool({
    mcpUrl,
    apiKey,
    name: "get_budget",
  });
  if (!budget.ok) {
    fail(`Cruise MCP get_budget failed: ${budget.reason}`);
  }
  ok("Cruise MCP get_budget answered");
  const lanes = await callCruiseMcpTool({
    mcpUrl,
    apiKey,
    name: "list_models",
    arguments: { kind: "lanes", modality: "chat" },
  });
  if (!lanes.ok) {
    fail(`Cruise MCP list_models failed: ${lanes.reason}`);
  }
  ok("Cruise MCP list_models (lanes/chat) answered");

  console.log("");
  ok("demo rehearsal passed");
  console.log(
    `Record verification as UTC in README: ${new Date().toISOString().slice(0, 10)} UTC`,
  );
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  main().catch((error) => {
    fail(error instanceof Error ? error.message : String(error));
  });
}
