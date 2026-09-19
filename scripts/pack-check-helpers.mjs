/**
 * Pure helpers for scripts/pack-check.mjs — kept separate so vitest can import
 * them without packing.
 */

/** Must match package.json `files` (+ package.json always included by npm). */
export const ALLOWED_TOP = new Set(["package.json", "README.md", "LICENSE", "dist"]);

export const FORBIDDEN_NAME =
  /(?:^|\/)(?:\.env|\.env\..*|credentials\.json|.*\.(?:pem|key))$/i;

/** Align with .gitleaks.toml cruise-key (prefix + 40 base62 chars). */
export const CRUISE_KEY = /\bcru_(?:live|demo|test|svc)_[A-Za-z0-9]{40}\b/;

/**
 * Validate the basename `npm pack` printed. Rejects path separators, `..`, and
 * leading `-` (option-injection shape) even though callers pass an absolute path
 * to `tar`.
 * @param {string} name
 * @returns {string} safe basename
 */
export function assertSafeTarballName(name) {
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    throw new Error(`pack:check: refusing unsafe tarball name: ${name}`);
  }
  if (name.startsWith("-")) {
    throw new Error(`pack:check: refusing tarball name starting with '-': ${name}`);
  }
  // First char must be alphanumeric/underscore/dot — not '-'.
  if (!/^[A-Za-z0-9_.][\w.-]*\.tgz$/.test(name)) {
    throw new Error(`pack:check: unexpected tarball basename: ${name}`);
  }
  return name;
}

/**
 * Top-level path segment for ALLOWED_TOP checks. Strips a leading `./` so a
 * defensive walk never treats `.` as the top segment (readdirSync never yields
 * that shape today; this keeps the check honest if a future walker changes).
 * @param {string} rel
 */
export function topLevelSegment(rel) {
  const normalized = rel.replace(/^\.\//, "");
  return normalized.split("/")[0] ?? normalized;
}

/**
 * Whether missing gitleaks should fail the check.
 * Release CI installs gitleaks; fail-closed there. Local shells may lack it and
 * still get the regex Cruise-key scan.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function gitleaksRequired(env = process.env) {
  return env.GITHUB_ACTIONS === "true" || env.CI === "true";
}
