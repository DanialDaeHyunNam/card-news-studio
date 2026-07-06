// Model/provider registry — the switchboard (pattern from ZCLIP's lib/config.ts).
// Adding a provider = add entries here + an adapter branch in lib/ai.ts.
// Pricing is USD per million tokens (input/output); cache read bills at 0.1×
// input, cache write (5m TTL) at 1.25× input.

export interface ModelInfo {
  id: string;
  label: string;
  short: string; // compact UI label
  provider: "anthropic" | "openai" | "google";
  envVar: string;
  implemented: boolean;
  // cachedInPerMTok: explicit cached-input rate (OpenAI). Anthropic cache
  // billing uses multipliers of the input rate instead (0.1× read, 1.25× write).
  pricing?: { inPerMTok: number; outPerMTok: number; cachedInPerMTok?: number };
  note: string;
}

export const MODELS: ModelInfo[] = [
  {
    id: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    short: "Opus 4.8",
    provider: "anthropic",
    envVar: "ANTHROPIC_API_KEY",
    implemented: true,
    pricing: { inPerMTok: 5, outPerMTok: 25 },
    note: "기본 · 카피 품질 최고",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    short: "Sonnet 4.6",
    provider: "anthropic",
    envVar: "ANTHROPIC_API_KEY",
    implemented: true,
    pricing: { inPerMTok: 3, outPerMTok: 15 },
    note: "밸런스",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    short: "Haiku 4.5",
    provider: "anthropic",
    envVar: "ANTHROPIC_API_KEY",
    implemented: true,
    pricing: { inPerMTok: 1, outPerMTok: 5 },
    note: "빠르고 저렴",
  },
  {
    id: "gpt-5.5",
    label: "GPT-5.5",
    short: "GPT-5.5",
    provider: "openai",
    envVar: "OPENAI_API_KEY",
    implemented: true,
    pricing: { inPerMTok: 5, outPerMTok: 30, cachedInPerMTok: 0.5 },
    note: "OpenAI 플래그십",
  },
  {
    id: "gpt-5.4",
    label: "GPT-5.4",
    short: "GPT-5.4",
    provider: "openai",
    envVar: "OPENAI_API_KEY",
    implemented: true,
    pricing: { inPerMTok: 2.5, outPerMTok: 15, cachedInPerMTok: 0.25 },
    note: "밸런스",
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    short: "GPT-5.4 mini",
    provider: "openai",
    envVar: "OPENAI_API_KEY",
    implemented: true,
    pricing: { inPerMTok: 0.75, outPerMTok: 4.5, cachedInPerMTok: 0.075 },
    note: "빠르고 저렴",
  },
  {
    id: "gpt-5.4-nano",
    label: "GPT-5.4 nano",
    short: "GPT-5.4 nano",
    provider: "openai",
    envVar: "OPENAI_API_KEY",
    implemented: true,
    pricing: { inPerMTok: 0.2, outPerMTok: 1.25, cachedInPerMTok: 0.02 },
    note: "초저가",
  },
  {
    id: "google-gemini",
    label: "Google Gemini",
    short: "Gemini",
    provider: "google",
    envVar: "GEMINI_API_KEY",
    implemented: false,
    note: "어댑터 준비 중 — 키 저장만 가능",
  },
];

export const DEFAULT_MODEL = "claude-opus-4-8";

export const KEY_ENV_VARS = [...new Set(MODELS.map((m) => m.envVar))];

export const PROVIDER_LABELS: Record<string, { label: string; keyUrl: string }> = {
  ANTHROPIC_API_KEY: { label: "Anthropic (Claude)", keyUrl: "https://platform.claude.com/settings/keys" },
  OPENAI_API_KEY: { label: "OpenAI", keyUrl: "https://platform.openai.com/api-keys" },
  GEMINI_API_KEY: { label: "Google Gemini", keyUrl: "https://aistudio.google.com/apikey" },
};

export function resolveModel(id: string | undefined): ModelInfo {
  const found = MODELS.find((m) => m.id === id && m.implemented);
  return found ?? MODELS.find((m) => m.id === DEFAULT_MODEL)!;
}
