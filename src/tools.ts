import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { resolveAllowedCruiseBaseUrl } from "./base-url.js";
import {
  CRUISE_API_KEY_ENV,
  CRUISE_BASE_URL,
  CRUISE_BASE_URL_ENV,
  PROVIDER_ID,
} from "./constants.js";
import { callCruiseMcpTool } from "./mcp-client.js";
import { resolveCruiseMcpUrl } from "./mcp-url.js";
import type { ResolveCruiseApiKeyOptions } from "./resolve-api-key.js";
import { resolveCruiseApiKey } from "./resolve-api-key.js";

export type CruiseToolsContext = {
  env?: Record<string, string | undefined>;
  stateDir?: string;
  resolveKey?: (options?: ResolveCruiseApiKeyOptions) => Promise<string | undefined>;
  fetchImpl?: typeof fetch;
  /** Injectable for tests — defaults to reading/writing opencode.json under directory. */
  readConfigFile?: (path: string) => Promise<string>;
  writeConfigFile?: (path: string, contents: string) => Promise<void>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function resolveWire(ctx: CruiseToolsContext) {
  const env = ctx.env ?? process.env;
  const resolveKey = ctx.resolveKey ?? resolveCruiseApiKey;
  const apiKey = await resolveKey({ env, stateDir: ctx.stateDir });
  const baseUrl = resolveAllowedCruiseBaseUrl(
    typeof env[CRUISE_BASE_URL_ENV] === "string" ? env[CRUISE_BASE_URL_ENV] : CRUISE_BASE_URL,
  );
  const mcpUrl = resolveCruiseMcpUrl(baseUrl);
  return { apiKey, baseUrl, mcpUrl, env };
}

/**
 * Inject Cruise as a remote OpenCode MCP server when the user has not already
 * configured `mcp.cruise`. Key stays in the environment via `{env:…}`.
 */
export function applyCruiseMcp(
  config: Config,
  options: { mcpUrl: string; enabled?: boolean } = {
    mcpUrl: resolveCruiseMcpUrl(),
  },
): { applied: boolean } {
  config.mcp ??= {};
  const existing = config.mcp[PROVIDER_ID];
  if (existing !== undefined) {
    return { applied: false };
  }
  config.mcp[PROVIDER_ID] = {
    type: "remote",
    url: options.mcpUrl,
    enabled: options.enabled ?? true,
    oauth: false,
    headers: {
      Authorization: `Bearer {env:${CRUISE_API_KEY_ENV}}`,
    },
  };
  return { applied: true };
}

function buildCruiseTools(ctx: CruiseToolsContext = {}) {
  return {
    cruise_list_models: tool({
      description:
        "List models and lanes this Cruise key can reach, with capabilities and list prices (USD per million tokens). Use a lane id such as bb/agentic-coding as the model name.",
      args: {
        kind: tool.schema
          .enum(["all", "lanes", "models"])
          .optional()
          .describe("Lanes only, pinned models only, or both. Default all."),
        modality: tool.schema
          .enum(["chat", "image", "speech", "embedding"])
          .optional()
          .describe("Only entries of this modality."),
      },
      async execute(args) {
        const wire = await resolveWire(ctx);
        if (!wire.apiKey) {
          return `Set ${CRUISE_API_KEY_ENV} (or /connect Cruise API Key). Never put the key in opencode.json.`;
        }
        const arguments_: Record<string, unknown> = {};
        if (args.kind) arguments_.kind = args.kind;
        if (args.modality) arguments_.modality = args.modality;
        const result = await callCruiseMcpTool({
          mcpUrl: wire.mcpUrl,
          apiKey: wire.apiKey,
          name: "list_models",
          arguments: arguments_,
          fetchImpl: ctx.fetchImpl,
        });
        return result.ok ? result.text : result.reason;
      },
    }),

    cruise_get_budget: tool({
      description:
        "This Cruise key's project budget for the current period, caps, action (serve/refuse), and the tenant wallet. Read-only.",
      args: {},
      async execute() {
        const wire = await resolveWire(ctx);
        if (!wire.apiKey) {
          return `Set ${CRUISE_API_KEY_ENV} (or /connect Cruise API Key). Never put the key in opencode.json.`;
        }
        const result = await callCruiseMcpTool({
          mcpUrl: wire.mcpUrl,
          apiKey: wire.apiKey,
          name: "get_budget",
          fetchImpl: ctx.fetchImpl,
        });
        return result.ok ? result.text : result.reason;
      },
    }),

    cruise_get_spend: tool({
      description:
        "What this Cruise key's project was charged in a calendar month, grouped by model or lane. Read-only.",
      args: {
        month: tool.schema
          .string()
          .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
          .optional()
          .describe("YYYY-MM. Default: current month (UTC)."),
        by: tool.schema
          .enum(["model", "lane"])
          .optional()
          .describe("Group by served model or requested lane. Default model."),
      },
      async execute(args) {
        const wire = await resolveWire(ctx);
        if (!wire.apiKey) {
          return `Set ${CRUISE_API_KEY_ENV} (or /connect Cruise API Key). Never put the key in opencode.json.`;
        }
        const arguments_: Record<string, unknown> = {};
        if (args.month) arguments_.month = args.month;
        if (args.by) arguments_.by = args.by;
        const result = await callCruiseMcpTool({
          mcpUrl: wire.mcpUrl,
          apiKey: wire.apiKey,
          name: "get_spend",
          arguments: arguments_,
          fetchImpl: ctx.fetchImpl,
        });
        return result.ok ? result.text : result.reason;
      },
    }),

    cruise_setup: tool({
      description:
        "Check the Cruise key (without revealing it), probe get_budget over MCP, and optionally write mcp.cruise into opencode.json with consent. The key stays in the environment.",
      args: {
        write_config: tool.schema
          .boolean()
          .optional()
          .describe(
            "If true, merge mcp.cruise into ./opencode.json after asking for permission. Default false (probe only).",
          ),
      },
      async execute(args, toolCtx) {
        const wire = await resolveWire(ctx);
        const lines: string[] = [];
        lines.push(`MCP URL: ${wire.mcpUrl}`);
        lines.push(
          wire.apiKey
            ? `${CRUISE_API_KEY_ENV}: set (value not shown)`
            : `${CRUISE_API_KEY_ENV}: missing — export a cru_… key or use /connect`,
        );

        if (!wire.apiKey) {
          return lines.join("\n");
        }

        const probe = await callCruiseMcpTool({
          mcpUrl: wire.mcpUrl,
          apiKey: wire.apiKey,
          name: "get_budget",
          fetchImpl: ctx.fetchImpl,
        });
        if (!probe.ok) {
          lines.push(`get_budget: failed — ${probe.reason}`);
          return lines.join("\n");
        }
        lines.push("get_budget: ok");
        lines.push(probe.text);

        if (!args.write_config) {
          lines.push(
            "Config not written. Re-run with write_config=true to merge mcp.cruise into opencode.json (asks first; key stays in env).",
          );
          return lines.join("\n");
        }

        try {
          await toolCtx.ask({
            permission: "edit",
            patterns: ["opencode.json"],
            always: ["opencode.json"],
            metadata: {
              reason:
                "Merge BytesBrains Cruise MCP (mcp.cruise) — Authorization uses {env:CRUISE_API_KEY}",
            },
          });
        } catch {
          lines.push("Write cancelled — permission not granted.");
          return lines.join("\n");
        }

        const configPath = join(toolCtx.directory, "opencode.json");
        const read = ctx.readConfigFile ?? ((path: string) => readFile(path, "utf8"));
        const write =
          ctx.writeConfigFile ?? ((path: string, contents: string) => writeFile(path, contents, "utf8"));

        let parsed: Record<string, unknown> = {
          $schema: "https://opencode.ai/config.json",
        };
        try {
          const raw = await read(configPath);
          const json: unknown = JSON.parse(raw);
          parsed = asRecord(json);
        } catch {
          /* create fresh */
        }

        const mcp = asRecord(parsed.mcp);
        if (mcp[PROVIDER_ID] !== undefined) {
          lines.push("opencode.json already has mcp.cruise — left unchanged.");
          return lines.join("\n");
        }

        parsed.mcp = {
          ...mcp,
          [PROVIDER_ID]: {
            type: "remote",
            url: wire.mcpUrl,
            enabled: true,
            oauth: false,
            headers: {
              Authorization: `Bearer {env:${CRUISE_API_KEY_ENV}}`,
            },
          },
        };
        if (!parsed.$schema) {
          parsed.$schema = "https://opencode.ai/config.json";
        }

        await write(configPath, `${JSON.stringify(parsed, null, 2)}\n`);
        lines.push(`Wrote mcp.cruise into ${configPath} (key still only in ${CRUISE_API_KEY_ENV}).`);
        return lines.join("\n");
      },
    }),
  };
}

/** Default tool map for the plugin (uses process env + auth store). */
export const cruiseTools = buildCruiseTools();

/** Test seam: build tools with injectable env / fetch / filesystem. */
export function createCruiseTools(ctx: CruiseToolsContext) {
  return buildCruiseTools(ctx);
}
