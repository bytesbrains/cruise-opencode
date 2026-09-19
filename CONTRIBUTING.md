# Contributing

Public OpenCode client for [BytesBrains Cruise](https://bytesbrains.com/cruise). Open pull
requests against `main`.

## Ground rules

- **Never commit a Cruise key** (`cru_live_…`, `cru_demo_…`, `cru_test_…`, `cru_svc_…`) or any
  provider credential. Keys live in the environment or a local `.env` (gitignored).
- **No telemetry, no second host.** Traffic only to the configured Cruise base URL.
- Keep the tree **public-safe**. Do not paste internal gateway design.

See [AGENT.md](./AGENT.md) for the full agent conventions list.

## Setup

```sh
npm install
npm run typecheck
npm run build
npm test
```

## Demo rehearsal

Prove the wire against the demo host before using a live key. Demo answers may be fabricated;
the point is connectivity, model ids, streaming, and (when accepted) tools.

```sh
cp .env.example .env
# edit .env — set CRUISE_API_KEY=cru_demo_… (never commit .env)
# optional: CRUISE_BASE_URL already defaults to the demo host in .env.example

npm run build
npm run rehearse:demo
```

The script:

1. Calls `GET /v1/models` and projects ids the way the plugin does (chat rows with `x-cruise`).
2. Runs a streamed `POST /v1/chat/completions` and prints Cruise response headers when present.
3. Sends a tool-bearing chat request (soft-skips only if the demo rejects tools with
   400/422 *and* no known Cruise `error.code` refusal; `budget_exhausted` and friends
   still fail the rehearsal).
4. Calls Cruise MCP `get_budget` and `list_models` on the same host’s `/mcp` path.

After a green run, update the README **Verified against demo** section with the **UTC** date
the script prints.

Optional OpenCode UI check (after the package is linked or published): set the same env,
load `@bytesbrains/opencode-cruise`, confirm `/models` lists the projected Cruise ids, and
try `cruise_get_budget` / `cruise_setup` (setup asks before writing `opencode.json`).

## Cutting a release

Publishing is a deliberate tag — a merge to `main` is never a release.

1. Bump `package.json` `version` and add a `CHANGELOG.md` entry in a PR; merge to `main`.
2. One-time (org owner): on [npmjs.com](https://www.npmjs.com) for
   `@bytesbrains/opencode-cruise`, add a Trusted Publisher —
   GitHub org `bytesbrains`, repo `cruise-opencode`, workflow `release.yml`.
3. Tag the merged main commit and push the tag:

```sh
git checkout main && git pull
git tag v0.1.0          # must match package.json version
git push origin v0.1.0
```

4. Watch the `release` workflow: it typechecks, builds, tests, runs `npm run pack:check`,
   then `npm publish` via OIDC (optional break-glass: repo secret `NPM_TOKEN`).
5. Confirm OpenCode auto-installs from `"plugin": ["@bytesbrains/opencode-cruise"]`.

Dry-run without publishing: Actions → `release` → Run workflow (`dry_run` defaults to true).
