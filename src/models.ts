/**
 * Project Cruise `GET /v1/models` rows into OpenCode provider model entries.
 *
 * No frozen catalogue — only chat rows with `x-cruise` metadata are kept.
 * Costs/windows come from live `x-cruise` fields (micros → $/MTok).
 */

const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_TOKENS = 8_192;
const MICROS_PER_DOLLAR = 1_000_000;

/** Jobs that typically need extended thinking / tool-heavy agent loops. */
const REASONING_LANE_JOBS = new Set([
  "agentic-coding",
  "deep-reasoning",
  "code-review",
  "hunter",
  "builder",
]);

export type CruiseLiveModelRow = {
  id?: unknown;
  object?: unknown;
  "x-cruise"?: unknown;
};

type CruiseExtension = {
  lane?: unknown;
  job?: unknown;
  description?: unknown;
  modality?: unknown;
  tools?: unknown;
  vision?: unknown;
  max_context?: unknown;
  max_output?: unknown;
  pricing?: unknown;
};

/** OpenCode `provider.<id>.models.<modelId>` entry. */
export type OpenCodeModelConfig = {
  name: string;
  reasoning?: boolean;
  tool_call?: boolean;
  cost?: {
    input: number;
    output: number;
    cache_read?: number;
    cache_write?: number;
  };
  limit?: {
    context: number;
    output: number;
  };
  modalities?: {
    input: Array<"text" | "image" | "audio" | "video" | "pdf">;
    output: Array<"text" | "image" | "audio" | "video" | "pdf">;
  };
};

function readPositiveInteger(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

/**
 * Cruise publishes rates as integer micros per million tokens.
 * OpenCode costs are dollars per million tokens → divide by 1e6.
 */
export function microsToDollarsPerMtok(micros: unknown): number | undefined {
  if (typeof micros !== "number" && (typeof micros !== "string" || !micros.trim())) {
    return undefined;
  }
  const number = typeof micros === "number" ? micros : Number(micros);
  if (!Number.isFinite(number) || number < 0) {
    return undefined;
  }
  return number / MICROS_PER_DOLLAR;
}

function readCruisePricing(value: unknown): {
  input?: number;
  output?: number;
  cacheRead?: number;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const pricing = value as Record<string, unknown>;
  return {
    input: microsToDollarsPerMtok(pricing.input_micros_per_mtok),
    output: microsToDollarsPerMtok(pricing.output_micros_per_mtok),
    cacheRead: microsToDollarsPerMtok(pricing.cached_input_micros_per_mtok),
  };
}

function readCruiseExtension(row: CruiseLiveModelRow): CruiseExtension | undefined {
  const raw = row["x-cruise"];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  return raw as CruiseExtension;
}

function laneDisplayName(ext: CruiseExtension, id: string): string {
  if (typeof ext.description === "string" && ext.description.trim()) {
    return ext.description.trim();
  }
  if (typeof ext.job === "string" && ext.job.trim()) {
    return `Cruise ${ext.job.trim()} (lane)`;
  }
  return id;
}

function resolveReasoning(ext: CruiseExtension): boolean {
  const isLane = ext.lane === true;
  const job = typeof ext.job === "string" ? ext.job.trim() : "";
  if (isLane && job) {
    return REASONING_LANE_JOBS.has(job);
  }
  return false;
}

function projectLiveModel(row: CruiseLiveModelRow): { id: string; model: OpenCodeModelConfig } | undefined {
  if (row.object !== undefined && row.object !== "model") {
    return undefined;
  }
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!id) {
    return undefined;
  }

  const ext = readCruiseExtension(row);
  // No frozen seeds — require x-cruise chat modality.
  if (!ext) {
    return undefined;
  }
  const modality = typeof ext.modality === "string" ? ext.modality.trim().toLowerCase() : "";
  if (modality !== "chat") {
    return undefined;
  }

  const isLane = ext.lane === true;
  const pricing = readCruisePricing(ext.pricing);
  const inputModalities: Array<"text" | "image"> =
    ext.vision === true ? ["text", "image"] : ["text"];

  return {
    id,
    model: {
      name: isLane ? laneDisplayName(ext, id) : id,
      reasoning: resolveReasoning(ext),
      tool_call: ext.tools !== false,
      cost: {
        input: pricing.input ?? 0,
        output: pricing.output ?? 0,
        cache_read: pricing.cacheRead ?? 0,
        cache_write: 0,
      },
      limit: {
        context: readPositiveInteger(ext.max_context) ?? DEFAULT_CONTEXT_WINDOW,
        output: readPositiveInteger(ext.max_output) ?? DEFAULT_MAX_TOKENS,
      },
      modalities: {
        input: inputModalities,
        output: ["text"],
      },
    },
  };
}

/**
 * Projects Cruise's authenticated `/models` response into an OpenCode models map.
 * Last-wins on duplicate ids.
 */
export function projectCruiseLiveModels(
  rows: readonly unknown[],
): Record<string, OpenCodeModelConfig> {
  const byId = new Map<string, OpenCodeModelConfig>();
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      continue;
    }
    const projected = projectLiveModel(row as CruiseLiveModelRow);
    if (!projected) {
      continue;
    }
    byId.set(projected.id, projected.model);
  }
  return Object.fromEntries(byId);
}
