import { describe, expect, it, vi } from "vitest";
import { resolveCruiseMcpUrl } from "../src/mcp-url.js";
import { callCruiseMcpTool } from "../src/mcp-client.js";
import { applyCruiseMcp, createCruiseTools } from "../src/tools.js";
import {
  CRUISE_API_KEY_ENV,
  CRUISE_BASE_URL,
  CRUISE_DEMO_BASE_URL,
} from "../src/constants.js";
import type { Config } from "@opencode-ai/plugin";

const MOCK_API_KEY = "mock-test-api-key";

describe("resolveCruiseMcpUrl", () => {
  it("maps allowed /v1 bases to /mcp on the same host", () => {
    expect(resolveCruiseMcpUrl(CRUISE_BASE_URL)).toBe("https://cruise.bytesbrains.net/mcp");
    expect(resolveCruiseMcpUrl(CRUISE_DEMO_BASE_URL)).toBe(
      "https://cruise-demo.bytesbrains.net/mcp",
    );
  });

  it("falls back to production MCP for disallowed hosts", () => {
    expect(resolveCruiseMcpUrl("https://evil.example/v1")).toBe(
      "https://cruise.bytesbrains.net/mcp",
    );
  });
});

describe("callCruiseMcpTool", () => {
  it("POSTs JSON-RPC tools/call and returns text content", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        jsonrpc: "2.0",
        id: 1,
        result: {
          content: [{ type: "text", text: "project demo · serve" }],
          structuredContent: { project: "demo", action: "serve" },
        },
      }),
    );
    const result = await callCruiseMcpTool({
      mcpUrl: "https://cruise-demo.bytesbrains.net/mcp",
      apiKey: MOCK_API_KEY,
      name: "get_budget",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("serve");
      expect(result.structured).toEqual({ project: "demo", action: "serve" });
    }
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, init] = fetchImpl.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.method).toBe("tools/call");
    expect(body.params.name).toBe("get_budget");
  });

  it("surfaces MCP tool errors", async () => {
    const result = await callCruiseMcpTool({
      mcpUrl: "https://cruise-demo.bytesbrains.net/mcp",
      apiKey: MOCK_API_KEY,
      name: "get_budget",
      fetchImpl: (async () =>
        Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: {
            isError: true,
            content: [{ type: "text", text: "Incorrect API key provided" }],
          },
        })) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Incorrect API key");
  });
});

describe("applyCruiseMcp", () => {
  it("injects mcp.cruise with env-based Authorization and does not overwrite", () => {
    const config: Config = {};
    expect(applyCruiseMcp(config, { mcpUrl: "https://cruise.bytesbrains.net/mcp" })).toEqual({
      applied: true,
    });
    expect(config.mcp?.cruise).toEqual({
      type: "remote",
      url: "https://cruise.bytesbrains.net/mcp",
      enabled: true,
      oauth: false,
      headers: { Authorization: `Bearer {env:${CRUISE_API_KEY_ENV}}` },
    });
    expect(applyCruiseMcp(config, { mcpUrl: "https://other/mcp" })).toEqual({ applied: false });
    expect(config.mcp?.cruise?.url).toBe("https://cruise.bytesbrains.net/mcp");
  });
});

describe("createCruiseTools", () => {
  it("cruise_get_budget calls MCP and returns the tool text", async () => {
    const tools = createCruiseTools({
      env: {
        [CRUISE_API_KEY_ENV]: MOCK_API_KEY,
        CRUISE_BASE_URL: CRUISE_DEMO_BASE_URL,
      },
      fetchImpl: (async () =>
        Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: {
            content: [{ type: "text", text: "budget ok" }],
            structuredContent: { project: "demo" },
          },
        })) as unknown as typeof fetch,
    });
    const out = await tools.cruise_get_budget.execute({}, {
      sessionID: "s",
      messageID: "m",
      agent: "build",
      directory: "/tmp",
      worktree: "/tmp",
      abort: new AbortController().signal,
      metadata: () => undefined,
      ask: async () => undefined,
    });
    expect(out).toBe("budget ok");
  });

  it("cruise_setup writes opencode.json only after ask + write_config", async () => {
    const files = new Map<string, string>();
    const ask = vi.fn(async () => undefined);
    const tools = createCruiseTools({
      env: {
        [CRUISE_API_KEY_ENV]: MOCK_API_KEY,
        CRUISE_BASE_URL: CRUISE_DEMO_BASE_URL,
      },
      fetchImpl: (async () =>
        Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: {
            content: [{ type: "text", text: "budget ok" }],
            structuredContent: { project: "demo" },
          },
        })) as unknown as typeof fetch,
      readConfigFile: async (path) => {
        const value = files.get(path);
        if (value === undefined) throw new Error("ENOENT");
        return value;
      },
      writeConfigFile: async (path, contents) => {
        files.set(path, contents);
      },
    });

    const probeOnly = await tools.cruise_setup.execute(
      { write_config: false },
      {
        sessionID: "s",
        messageID: "m",
        agent: "build",
        directory: "/tmp/proj",
        worktree: "/tmp/proj",
        abort: new AbortController().signal,
        metadata: () => undefined,
        ask,
      },
    );
    expect(String(probeOnly)).toContain("get_budget: ok");
    expect(ask).not.toHaveBeenCalled();
    expect(files.size).toBe(0);

    const written = await tools.cruise_setup.execute(
      { write_config: true },
      {
        sessionID: "s",
        messageID: "m",
        agent: "build",
        directory: "/tmp/proj",
        worktree: "/tmp/proj",
        abort: new AbortController().signal,
        metadata: () => undefined,
        ask,
      },
    );
    expect(ask).toHaveBeenCalledOnce();
    expect(String(written)).toContain("Wrote mcp.cruise");
    const saved = JSON.parse(files.get("/tmp/proj/opencode.json")!);
    expect(saved.mcp.cruise.type).toBe("remote");
    expect(saved.mcp.cruise.headers.Authorization).toContain("{env:CRUISE_API_KEY}");
    expect(JSON.stringify(saved)).not.toContain(MOCK_API_KEY);
  });

  it("cruise_setup reports write failures without throwing", async () => {
    const ask = vi.fn(async () => undefined);
    const tools = createCruiseTools({
      env: {
        [CRUISE_API_KEY_ENV]: MOCK_API_KEY,
        CRUISE_BASE_URL: CRUISE_DEMO_BASE_URL,
      },
      fetchImpl: (async () =>
        Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: {
            content: [{ type: "text", text: "budget ok" }],
          },
        })) as unknown as typeof fetch,
      readConfigFile: async () => {
        throw new Error("ENOENT");
      },
      writeConfigFile: async () => {
        throw new Error("EACCES");
      },
    });

    const out = await tools.cruise_setup.execute(
      { write_config: true },
      {
        sessionID: "s",
        messageID: "m",
        agent: "build",
        directory: "/tmp/proj",
        worktree: "/tmp/proj",
        abort: new AbortController().signal,
        metadata: () => undefined,
        ask,
      },
    );

    expect(ask).toHaveBeenCalledOnce();
    expect(String(out)).toContain("Could not write mcp.cruise into /tmp/proj/opencode.json");
    expect(String(out)).toContain("EACCES");
  });
});
