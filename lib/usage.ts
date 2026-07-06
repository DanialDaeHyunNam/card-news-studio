// Per-project token/cost accounting. One UsageEvent per AI call (returned by
// the API routes); totals live on project.usage and feed the topbar popover.

export interface UsageEvent {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
}

export interface UsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  byModel: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }>;
}

export function emptyUsage(): UsageTotals {
  return {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    costUsd: 0,
    byModel: {},
  };
}

export function addUsage(prev: UsageTotals | undefined, ev: UsageEvent | undefined): UsageTotals {
  const t = prev ? structuredClone(prev) : emptyUsage();
  if (!ev) return t;
  t.calls += 1;
  t.inputTokens += ev.inputTokens;
  t.outputTokens += ev.outputTokens;
  t.cacheReadTokens += ev.cacheReadTokens;
  t.cacheCreationTokens += ev.cacheCreationTokens;
  t.costUsd += ev.costUsd;
  const m = (t.byModel[ev.model] ??= { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
  m.calls += 1;
  m.inputTokens += ev.inputTokens + ev.cacheReadTokens + ev.cacheCreationTokens;
  m.outputTokens += ev.outputTokens;
  m.costUsd += ev.costUsd;
  return t;
}

export function fmtCost(usd: number): string {
  if (usd === 0) return "$0";
  return usd < 0.1 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;
}

export function fmtTokens(n: number): string {
  if (n < 1000) return String(n);
  return n < 1_000_000 ? `${(n / 1000).toFixed(1)}k` : `${(n / 1_000_000).toFixed(2)}M`;
}
