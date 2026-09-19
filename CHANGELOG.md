# Changelog

## 0.1.0 — 2026-09-20

First npm release of `@bytesbrains/opencode-cruise`.

- OpenCode plugin: live `GET /v1/models` discovery with `x-cruise` projection, `/connect`
  API-key auth, and demo rehearsal (`npm run rehearse:demo`).
- Tag-triggered `release.yml` with npm OIDC Trusted Publisher and `npm run pack:check`
  so a merge is never a publish.
