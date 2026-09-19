# AGENT.md — guidance for agents working in this repository

## What this is

Public **OpenCode** client for [BytesBrains Cruise](https://bytesbrains.com/cruise): an npm
plugin (and verified provider recipe) that registers Cruise so OpenCode sessions route through
the gateway.

Cruise holds provider keys, project budgets, and the cost ledger. This repo only ships the
OpenCode side: present a `cru_` key to a Cruise base URL and project Cruise’s catalogue into
OpenCode models.

OpenCode already supports custom OpenAI-compatible providers via `opencode.json`
([providers docs](https://opencode.ai/docs/providers/)) and npm plugins via the `plugin` array
([plugins docs](https://opencode.ai/docs/plugins/)). The deliverable here is the published
plugin that makes that wiring one install — not a second place spend can happen.

## Host facts (check docs before coding)

- Custom provider: `npm` / `package` for OpenAI-compatible chat → `@ai-sdk/openai-compatible`
  (or the current OpenCode-documented equivalent); `options.baseURL` must include `/v1`.
- Credentials: prefer env (`CRUISE_API_KEY`) or OpenCode’s `/connect` auth store — never commit
  keys into `opencode.json`.
- Plugins load from npm packages named in `"plugin": [...]` and from local
  `.opencode/plugins/` / `~/.config/opencode/plugins/`.
- Model ids must be **Cruise ids** from `GET /v1/models` for the presented key.

Sister clients to match for tone and key-handling:
[cruise-hermes](https://github.com/bytesbrains/cruise-hermes),
[openclaw-cruise](https://github.com/bytesbrains/openclaw-cruise),
[cruise-vscode](https://github.com/bytesbrains/cruise-vscode).

## Conventions a change must honour

- **Never commit a Cruise key** (`cru_live_…`, `cru_demo_…`, `cru_test_…`, `cru_svc_…`) or any
  provider credential. Keys live in the environment or a secret manager.
- **No telemetry, no second host.** Traffic only to the configured Cruise base URL.
- Keep the tree **public-safe**. Do not paste internal gateway design, private trackers, or
  unpublished roadmap. Public product behaviour (base URL, key shapes, `/v1/models`, refusal
  codes) is fine.
- Model ids are **Cruise ids** from `GET /v1/models` — never invent upstream provider ids.
  Prefer lanes (`bb/…`) over pinned models unless a pin is required. Do not ship a frozen
  catalogue in the published artifact.
- Branch Cruise refusals on `error.code` (`budget_exhausted`, `wallet_exhausted`,
  `measurement_stale`, …), not on HTTP status alone.
- Publishing is a **person running a command** (or a tag workflow with Trusted Publisher) —
  a release that fires on every merge separates the artifact from whoever made it.
- Open changes as pull requests against `main`. Do not force-push or delete `main`.

## Layout (target — land in issues)

| Path | Role |
| --- | --- |
| `package.json` | npm package `@bytesbrains/opencode-cruise` (name confirm in #1) |
| `src/` | Plugin entry + provider registration / model fetch |
| `README.md` | Product pitch, install, demo rehearsal |
| `SECURITY.md` | Private vulnerability disclosure |
| `AGENT.md` | This file — agent conventions |
| `LICENSE` | BytesBrains proprietary client license |
| `.github/workflows/` | CI + optional publish-on-`v*` tag |

## Open work

See [GitHub issues](https://github.com/bytesbrains/cruise-opencode/issues). Pick an open issue,
open a PR against `main`, and keep the README status line honest until the package is
published and demo-verified.
