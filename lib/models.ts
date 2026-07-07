// Model/provider registry — the switchboard (pattern from ZCLIP's lib/config.ts).
// Adding a model = add ONE entry here. Adding a whole new provider = add an
// `apiBase` (if it speaks the OpenAI wire format) or a branch in lib/ai.ts.
// Pricing is USD per million tokens (input/output); Anthropic cache read bills
// at 0.1× input, cache write (5m TTL) at 1.25× input.

export type Provider = "anthropic" | "openai" | "google";

export interface ModelInfo {
  id: string;
  label: string;
  short: string; // compact UI label
  provider: Provider;
  envVar: string;
  // OpenAI-compatible providers (openai, google) hit `${apiBase}/chat/completions`.
  // Anthropic goes through the official SDK and ignores apiBase.
  apiBase?: string;
  implemented: boolean;
  // "recommended" models show by default in the picker; "more" hide behind the
  // "모든 모델 / All models" expander.
  tier: "recommended" | "more";
  // 1 = quality-first / slower, 3 = fastest. Drives the little speed meter.
  speed: 1 | 2 | 3;
  // cachedInPerMTok: explicit cached-input rate (OpenAI). Anthropic cache
  // billing uses multipliers of the input rate instead (0.1× read, 1.25× write).
  pricing?: { inPerMTok: number; outPerMTok: number; cachedInPerMTok?: number };
  // Short spec blurb shown under the model name, [ko, en].
  note: [string, string];
}

const OPENAI_BASE = "https://api.openai.com/v1";
// Gemini's OpenAI-compatible endpoint — same chat/completions wire format, so
// it reuses the OpenAI adapter in lib/ai.ts (Bearer <GEMINI_API_KEY>).
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";

export const MODELS: ModelInfo[] = [
  // ---- Anthropic (Claude) ----
  {
    id: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    short: "Opus 4.8",
    provider: "anthropic",
    envVar: "ANTHROPIC_API_KEY",
    implemented: true,
    tier: "recommended",
    speed: 1,
    pricing: { inPerMTok: 5, outPerMTok: 25 },
    note: ["최고 품질 · 기본값", "Best quality · default"],
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    short: "Sonnet 5",
    provider: "anthropic",
    envVar: "ANTHROPIC_API_KEY",
    implemented: true,
    tier: "recommended",
    speed: 2,
    pricing: { inPerMTok: 3, outPerMTok: 15 },
    note: ["균형 · 고속", "Balanced · fast"],
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    short: "Haiku 4.5",
    provider: "anthropic",
    envVar: "ANTHROPIC_API_KEY",
    implemented: true,
    tier: "recommended",
    speed: 3,
    pricing: { inPerMTok: 1, outPerMTok: 5 },
    note: ["초고속 · 저가", "Fastest · cheap"],
  },
  {
    id: "claude-fable-5",
    label: "Claude Fable 5",
    short: "Fable 5",
    provider: "anthropic",
    envVar: "ANTHROPIC_API_KEY",
    implemented: true,
    tier: "more",
    speed: 1,
    pricing: { inPerMTok: 10, outPerMTok: 50 },
    note: ["최상위 · 고가", "Most capable · premium"],
  },
  {
    id: "claude-opus-4-7",
    label: "Claude Opus 4.7",
    short: "Opus 4.7",
    provider: "anthropic",
    envVar: "ANTHROPIC_API_KEY",
    implemented: true,
    tier: "more",
    speed: 1,
    pricing: { inPerMTok: 5, outPerMTok: 25 },
    note: ["구형 플래그십", "Prev-gen flagship"],
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    short: "Sonnet 4.6",
    provider: "anthropic",
    envVar: "ANTHROPIC_API_KEY",
    implemented: true,
    tier: "more",
    speed: 2,
    pricing: { inPerMTok: 3, outPerMTok: 15 },
    note: ["구형 균형", "Older balanced"],
  },

  // ---- OpenAI ---- (pricing per OpenAI pricing page, verified 2026-07)
  {
    id: "gpt-5.5",
    label: "GPT-5.5",
    short: "GPT-5.5",
    provider: "openai",
    envVar: "OPENAI_API_KEY",
    apiBase: OPENAI_BASE,
    implemented: true,
    tier: "recommended",
    speed: 2,
    pricing: { inPerMTok: 5, outPerMTok: 30, cachedInPerMTok: 0.5 },
    note: ["OpenAI 플래그십", "OpenAI flagship"],
  },
  {
    id: "gpt-5.4",
    label: "GPT-5.4",
    short: "GPT-5.4",
    provider: "openai",
    envVar: "OPENAI_API_KEY",
    apiBase: OPENAI_BASE,
    implemented: true,
    tier: "recommended",
    speed: 2,
    pricing: { inPerMTok: 2.5, outPerMTok: 15, cachedInPerMTok: 0.25 },
    note: ["균형", "Balanced"],
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    short: "GPT-5.4 mini",
    provider: "openai",
    envVar: "OPENAI_API_KEY",
    apiBase: OPENAI_BASE,
    implemented: true,
    tier: "recommended",
    speed: 3,
    pricing: { inPerMTok: 0.75, outPerMTok: 4.5, cachedInPerMTok: 0.075 },
    note: ["빠르고 저렴", "Fast · cheap"],
  },
  {
    id: "gpt-5.4-nano",
    label: "GPT-5.4 nano",
    short: "GPT-5.4 nano",
    provider: "openai",
    envVar: "OPENAI_API_KEY",
    apiBase: OPENAI_BASE,
    implemented: true,
    tier: "recommended",
    speed: 3,
    pricing: { inPerMTok: 0.2, outPerMTok: 1.25, cachedInPerMTok: 0.02 },
    note: ["초저가", "Cheapest"],
  },
  // GPT-5.6 family — newest, but LIMITED PREVIEW (needs preview access, not just
  // any OpenAI key). IDs assume the `gpt-5.6-<tier>` convention; confirm on GA.
  {
    id: "gpt-5.6-sol",
    label: "GPT-5.6 Sol",
    short: "GPT-5.6 Sol",
    provider: "openai",
    envVar: "OPENAI_API_KEY",
    apiBase: OPENAI_BASE,
    implemented: true,
    tier: "more",
    speed: 1,
    pricing: { inPerMTok: 5, outPerMTok: 30, cachedInPerMTok: 0.5 },
    note: ["최신 플래그십 · 프리뷰", "Newest flagship · preview"],
  },
  {
    id: "gpt-5.6-terra",
    label: "GPT-5.6 Terra",
    short: "GPT-5.6 Terra",
    provider: "openai",
    envVar: "OPENAI_API_KEY",
    apiBase: OPENAI_BASE,
    implemented: true,
    tier: "more",
    speed: 2,
    pricing: { inPerMTok: 2.5, outPerMTok: 15, cachedInPerMTok: 0.25 },
    note: ["최신 균형 · 프리뷰", "New balanced · preview"],
  },
  {
    id: "gpt-5.6-luna",
    label: "GPT-5.6 Luna",
    short: "GPT-5.6 Luna",
    provider: "openai",
    envVar: "OPENAI_API_KEY",
    apiBase: OPENAI_BASE,
    implemented: true,
    tier: "more",
    speed: 3,
    pricing: { inPerMTok: 1, outPerMTok: 6, cachedInPerMTok: 0.1 },
    note: ["최신 고속 · 프리뷰", "New fast · preview"],
  },

  // ---- Google (Gemini) ---- (pricing per ai.google.dev, verified 2026-07)
  // Served through Gemini's OpenAI-compatible endpoint — one adapter, same wire
  // format. Gemini 3.x model IDs assume the `gemini-3.x-<tier>` convention;
  // confirm the exact snapshot ids on ai.google.dev if a call 404s.
  {
    id: "gemini-3.1-pro",
    label: "Gemini 3.1 Pro",
    short: "Gemini 3.1 Pro",
    provider: "google",
    envVar: "GEMINI_API_KEY",
    apiBase: GEMINI_BASE,
    implemented: true,
    tier: "recommended",
    speed: 2,
    pricing: { inPerMTok: 2, outPerMTok: 12 },
    note: ["플래그십 · 고품질", "Flagship · strong"],
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    short: "Gemini 3.5 Flash",
    provider: "google",
    envVar: "GEMINI_API_KEY",
    apiBase: GEMINI_BASE,
    implemented: true,
    tier: "recommended",
    speed: 3,
    pricing: { inPerMTok: 1.5, outPerMTok: 9, cachedInPerMTok: 0.15 },
    note: ["최신 고속", "Latest fast"],
  },
  {
    id: "gemini-3-flash",
    label: "Gemini 3 Flash",
    short: "Gemini 3 Flash",
    provider: "google",
    envVar: "GEMINI_API_KEY",
    apiBase: GEMINI_BASE,
    implemented: true,
    tier: "recommended",
    speed: 3,
    pricing: { inPerMTok: 0.5, outPerMTok: 3 },
    note: ["고속 · 저가", "Fast · cheap"],
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
    short: "Gemini 3.1 Flash-Lite",
    provider: "google",
    envVar: "GEMINI_API_KEY",
    apiBase: GEMINI_BASE,
    implemented: true,
    tier: "more",
    speed: 3,
    pricing: { inPerMTok: 0.25, outPerMTok: 1.5 },
    note: ["초저가", "Cheapest"],
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    short: "Gemini 2.5 Pro",
    provider: "google",
    envVar: "GEMINI_API_KEY",
    apiBase: GEMINI_BASE,
    implemented: true,
    tier: "more",
    speed: 2,
    pricing: { inPerMTok: 1.25, outPerMTok: 10 },
    note: ["구형 · 고품질", "Older · strong"],
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    short: "Gemini 2.5 Flash-Lite",
    provider: "google",
    envVar: "GEMINI_API_KEY",
    apiBase: GEMINI_BASE,
    implemented: true,
    tier: "more",
    speed: 3,
    pricing: { inPerMTok: 0.1, outPerMTok: 0.4 },
    note: ["구형 초저가", "Older cheapest"],
  },
];

export const DEFAULT_MODEL = "claude-opus-4-8";

export const KEY_ENV_VARS = [...new Set(MODELS.map((m) => m.envVar))];

// Provider display order + labels for the grouped model picker.
export const PROVIDER_ORDER: Provider[] = ["anthropic", "openai", "google"];
export const PROVIDER_NAMES: Record<Provider, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
  google: "Gemini",
};

export const PROVIDER_LABELS: Record<string, { label: string; keyUrl: string }> = {
  ANTHROPIC_API_KEY: { label: "Anthropic (Claude)", keyUrl: "https://platform.claude.com/settings/keys" },
  OPENAI_API_KEY: { label: "OpenAI", keyUrl: "https://platform.openai.com/api-keys" },
  GEMINI_API_KEY: { label: "Google Gemini", keyUrl: "https://aistudio.google.com/apikey" },
};

export function resolveModel(id: string | undefined): ModelInfo {
  const found = MODELS.find((m) => m.id === id && m.implemented);
  return found ?? MODELS.find((m) => m.id === DEFAULT_MODEL)!;
}

// Cost-effective "value" pick per provider — NOT the flagship. The UI defaults
// to one of these so a fresh project starts cheap; the user can still pick a
// pricier model manually.
const VALUE_DEFAULT: Record<Provider, string> = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-5.4-mini",
  google: "gemini-3-flash",
};

// The value model to default to given the connected keys (provider order wins
// when several are connected). Falls back to the first provider's value model
// before keys are known / when nothing is connected yet.
export function pickDefaultModel(keys: Record<string, boolean> | null): string {
  if (keys) {
    for (const p of PROVIDER_ORDER) {
      const envVar = MODELS.find((m) => m.provider === p)!.envVar;
      if (keys[envVar]) return VALUE_DEFAULT[p];
    }
  }
  return VALUE_DEFAULT[PROVIDER_ORDER[0]];
}

// Compact "$in / $out" per-1M price string for the picker spec line.
export function priceLabel(m: ModelInfo): string {
  if (!m.pricing) return "";
  const f = (n: number) => (n < 1 ? `$${n}` : `$${n % 1 === 0 ? n : n.toFixed(2)}`);
  return `${f(m.pricing.inPerMTok)} / ${f(m.pricing.outPerMTok)}`;
}
