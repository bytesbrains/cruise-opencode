<p align="center">
  <img src="https://bytesbrains.com/brand/cruise-logo-480.png" alt="BytesBrains Cruise" width="280" />
</p>

<h1 align="center">BytesBrains Cruise for OpenCode</h1>

<p align="center">
  Every model your Cruise key can reach — as an OpenCode provider / plugin —<br />
  with budgets, per-project keys, and one cost ledger that stay on the gateway.
</p>

<p align="center">
  <a href="https://bytesbrains.com/cruise"><img src="https://img.shields.io/badge/Product-bytesbrains.com%2Fcruise-111111" alt="Product" /></a>
  <a href="https://www.npmjs.com/package/@bytesbrains/opencode-cruise"><img src="https://img.shields.io/npm/v/@bytesbrains/opencode-cruise?label=npm" alt="npm" /></a>
  <a href="https://opencode.ai/docs/providers/"><img src="https://img.shields.io/badge/Host-OpenCode-555" alt="OpenCode docs" /></a>
  <a href="https://github.com/bytesbrains/cruise-opencode"><img src="https://img.shields.io/badge/Source-bytesbrains%2Fcruise--opencode-111111" alt="Source" /></a>
</p>

---

## What this is

[BytesBrains Cruise](https://bytesbrains.com/cruise) is one OpenAI-compatible endpoint in front of
every model provider. This repository is the **[OpenCode](https://opencode.ai)** client: a
published plugin (and the verified recipe behind it) so sessions route through the gateway.

Your keys, budgets and ledger stay on the gateway. OpenCode only holds a `cru_` key and talks to
the base URL you configure.

| | |
| --- | --- |
| **Product** | [bytesbrains.com/cruise](https://bytesbrains.com/cruise) |
| **Source** | [bytesbrains/cruise-opencode](https://github.com/bytesbrains/cruise-opencode) |
| **Host** | [OpenCode](https://opencode.ai) — [providers](https://opencode.ai/docs/providers/), [plugins](https://opencode.ai/docs/plugins/) |
| **Production API** | `https://cruise.bytesbrains.net/v1` |
| **Demo API** | `https://cruise-demo.bytesbrains.net/v1` |

**Status:** demo-verified; npm package `@bytesbrains/opencode-cruise` `0.1.0` — publish by
tagging `v0.1.0` after Trusted Publisher is configured (see
[CONTRIBUTING.md](./CONTRIBUTING.md)). Track work in
[GitHub issues](https://github.com/bytesbrains/cruise-opencode/issues). Sister clients that
already ship: [cruise-vscode](https://github.com/bytesbrains/cruise-vscode),
[cruise-hermes](https://github.com/bytesbrains/cruise-hermes),
[openclaw-cruise](https://github.com/bytesbrains/openclaw-cruise),
[cruise-cursor-plugin](https://github.com/bytesbrains/cruise-cursor-plugin),
[cruise-claude-plugin](https://github.com/bytesbrains/cruise-claude-plugin).

---

## Install

Add the plugin and set a Cruise key. Once `v0.1.0` is tagged, OpenCode installs from npm via
the `plugin` array. The plugin registers provider `cruise`
(`npm: @ai-sdk/openai-compatible`, base URL with `/v1`) and fills models from live
`GET /v1/models` for that key — never a frozen catalogue.

```jsonc
// opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@bytesbrains/opencode-cruise"],
  // optional — prefer a lane once models are discovered:
  // "model": "cruise/bb/agentic-coding"
}
```

```sh
export CRUISE_API_KEY=cru_demo_…   # or cru_live_…
# optional — defaults to production:
# export CRUISE_BASE_URL=https://cruise.bytesbrains.net/v1
```

Or copy [`.env.example`](./.env.example) to `.env` for local rehearsal. You can also run
`/connect` in OpenCode and choose **Cruise API Key** (same provider id: `cruise`).

Manual custom provider (no plugin) if you only need two strings + pasted model ids:

```jsonc
// manual fallback (bucket A — two strings + models you paste from GET /v1/models)
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "cruise": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "BytesBrains Cruise",
      "env": ["CRUISE_API_KEY"],
      "options": {
        "baseURL": "https://cruise-demo.bytesbrains.net/v1",
        "apiKey": "{env:CRUISE_API_KEY}"
      },
      "models": {
        "bb/agentic-coding": { "name": "Agentic Coding (lane)" }
      }
    }
  }
}
```

Prefer rehearsing on the demo host first.

### Budget tools (Cruise MCP)

The plugin registers read-only tools that call Cruise’s remote MCP with the same `cru_` key:

| Tool | Answers |
| --- | --- |
| `cruise_list_models` | models/lanes this key can reach (optional `kind`, `modality`) |
| `cruise_get_budget` | project budget period, caps, `action`, and wallet |
| `cruise_get_spend` | month’s charges by model or lane |
| `cruise_setup` | check key + probe `get_budget`; with consent, merge `mcp.cruise` into `opencode.json` |

Production MCP: `https://cruise.bytesbrains.net/mcp` · Demo:
`https://cruise-demo.bytesbrains.net/mcp`. The key stays in `CRUISE_API_KEY` (or `/connect`) —
never in config. Optional host-managed MCP (same server) after `cruise_setup` with
`write_config=true`:

```jsonc
"mcp": {
  "cruise": {
    "type": "remote",
    "url": "https://cruise.bytesbrains.net/mcp",
    "oauth": false,
    "headers": { "Authorization": "Bearer {env:CRUISE_API_KEY}" }
  }
}
```

### Develop from this repo

```sh
npm install
npm run typecheck
npm run build
npm test
```

### Demo rehearsal

```sh
cp .env.example .env   # set CRUISE_API_KEY=cru_demo_… — never commit .env
npm run build
npm run rehearse:demo
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for what the script checks.

### Verified against demo

**2026-09-19 UTC** — `@bytesbrains/opencode-cruise` `0.1.0` (built locally), env:

```text
CRUISE_API_KEY=cru_demo_…          # never committed
CRUISE_BASE_URL=https://cruise-demo.bytesbrains.net/v1
```

| Check | Result |
| --- | --- |
| `npm run rehearse:demo` | passed |
| Live catalogue | plugin projection **63** ids from `GET /v1/models`, incl. `bb/agentic-coding` |
| Streamed chat | `POST /v1/chat/completions` SSE completed (`bb/agentic-coding` → `x-cruise-model: anthropic/claude-fable-5-1`, budget ok) |
| Tools | tool-bearing chat request accepted (demo fabricates the body) |
| Cruise MCP | `get_budget` + `list_models` over `/mcp` (see latest `rehearse:demo` run) |

Demo holds no provider credential — answers may be fabricated; the point is the wire.

### Refusals

Cruise declines with `error.code` (`budget_exhausted`, `wallet_exhausted`,
`measurement_stale`, …). Branch on that code — not HTTP status alone. The plugin logs
known refusal codes on `session.error` when the body is present.
---

## Conventions

- **Key in the environment** (`CRUISE_API_KEY`), never in a committed `opencode.json`.
- **Model ids are Cruise ids** from `GET /v1/models` for the presented key — lanes (`bb/…`)
  preferred over pinned upstream ids.
- **No traffic anywhere but the configured Cruise base URL.** No telemetry, no second host.
- **Branch refusals on `error.code`**, not HTTP status alone (`budget_exhausted`,
  `wallet_exhausted`, `measurement_stale`, …).
- **Rehearse on the demo** (`cruise-demo.bytesbrains.net` + `cru_demo_` key) before production.

See [AGENT.md](./AGENT.md) for agent working notes and [SECURITY.md](./SECURITY.md) for disclosure.

---

## License

© 2026 BYTESBRAINS PTE. LTD. See [LICENSE](./LICENSE).
