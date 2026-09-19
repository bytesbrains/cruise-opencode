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

**Status:** package scaffold builds locally (`@bytesbrains/opencode-cruise` `0.0.0`) — not
published yet; provider registration is [#2](https://github.com/bytesbrains/cruise-opencode/issues/2).
Track work in [GitHub issues](https://github.com/bytesbrains/cruise-opencode/issues). Sister
clients that already ship: [cruise-vscode](https://github.com/bytesbrains/cruise-vscode),
[cruise-hermes](https://github.com/bytesbrains/cruise-hermes),
[openclaw-cruise](https://github.com/bytesbrains/openclaw-cruise),
[cruise-cursor-plugin](https://github.com/bytesbrains/cruise-cursor-plugin),
[cruise-claude-plugin](https://github.com/bytesbrains/cruise-claude-plugin).

---

## Install (after publish)

OpenCode already speaks OpenAI-compatible providers. The plugin will make the Cruise wiring
one package install plus a key in the environment — model ids from `GET /v1/models`, never a
frozen catalogue.

```jsonc
// opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@bytesbrains/opencode-cruise"]
}
```

```sh
export CRUISE_API_KEY=cru_demo_…   # or cru_live_…
# optional — defaults to production:
# export CRUISE_BASE_URL=https://cruise.bytesbrains.net/v1
```

Until npm publish ([#4](https://github.com/bytesbrains/cruise-opencode/issues/4)) and provider
wiring ([#2](https://github.com/bytesbrains/cruise-opencode/issues/2)), a manual custom provider
is still valid OpenCode config. Prefer rehearsing on the demo host first.

### Develop from this repo

```sh
npm install
npm run typecheck
npm run build
npm test
```

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
