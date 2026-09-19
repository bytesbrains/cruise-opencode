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

## Layout

| Path | Role |
| --- | --- |
| `package.json` | npm package `@bytesbrains/opencode-cruise` |
| `src/index.ts` | OpenCode `Plugin` entry (`config` + `auth` + `tool` hooks) |
| `src/provider.ts` | Registers `cruise` + live `GET /v1/models` fill |
| `src/models.ts` | Projects Cruise `x-cruise` rows → OpenCode model map |
| `src/fetch-models.ts` | Authenticated models list fetch |
| `src/base-url.ts` | HTTPS prod/demo host allowlist |
| `src/mcp-url.ts` | Maps `/v1` base → `/mcp` on the same allowlisted host |
| `src/mcp-client.ts` | JSON-RPC `tools/call` against Cruise MCP |
| `src/tools.ts` | Plugin tools (`cruise_list_models`, budget/spend, setup) |
| `src/resolve-api-key.ts` | Env + OpenCode `auth.json` key resolution |
| `src/errors.ts` | `error.code` refusal helpers |
| `src/auth.ts` | `/connect` API-key method for provider `cruise` |
| `scripts/rehearse-demo.mjs` | Live demo wire check (models + stream + tools + MCP) |
| `scripts/pack-check.mjs` | Pack tarball + refuse secrets / unexpected paths |
| `test/` | Vitest unit tests (mocked `/v1/models`) |
| `.env.example` | `CRUISE_API_KEY` / `CRUISE_BASE_URL` placeholders |
| `dist/` | `tsc` build output (published; not committed) |
| `CHANGELOG.md` | Released versions (bump with `package.json`) |
| `README.md` | Product pitch, install, demo rehearsal |
| `CONTRIBUTING.md` | Setup, demo rehearsal, how to cut a release |
| `SECURITY.md` | Private vulnerability disclosure |
| `AGENT.md` | This file — agent conventions |
| `LICENSE` | BytesBrains proprietary client license |
| `.gitleaks.toml` | Cruise-key rule for pack/CI secret scans |
| `.github/workflows/ci.yml` | Typecheck / build / test on PRs |
| `.github/workflows/release.yml` | Publish on `v*` tag (OIDC Trusted Publisher) |

## Open work

See [GitHub issues](https://github.com/bytesbrains/cruise-opencode/issues). Pick an open issue,
open a PR against `main`. Releases are tag-only — see [CONTRIBUTING.md](./CONTRIBUTING.md).
