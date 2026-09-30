// The create harness: analyze → (ask the user ↔ answer)* → generate.
// Provider-agnostic by construction — every step is an AiRequest built in
// lib/requests.ts and sent through lib/ai-transport.ts, so the subscription CLI,
// API keys (Claude / OpenAI / Gemini) and hosted BYOK all run the same loop.
// Each track keeps its native strengths underneath (CLI: Claude Code's own
// caching; Anthropic API: a cache breakpoint after the images + server-side
// refusal fallbacks; OpenAI: automatic prefix caching) with effort pinned per
// step so quality matches across tracks.
//
// The model decides whether the photos suffice. When they don't, the UI shows
// its question (with reasons + suggested answers), the user uploads more /
// picks an answer / types one, and the analysis re-runs with the dialogue.
import { streamPlan } from "./ai-transport";
import { extractReply, parseStructured } from "./stream";
import { LAYOUT_KINDS, LAYOUT_SLOTS, type LayoutKind, type PlannedCard, type RefStyle } from "./photoset";
import type { PlanBody } from "./requests";
import type { UsageEvent } from "./usage";

export interface Plan {
  reply: string;
  referenceLayout: string;
  style: RefStyle | null; // null when the model returned nothing usable
  cards: PlannedCard[];
  sufficient: boolean;
  needMore: number;
  question: string;
  options: string[];
}

// Clamp the measured style to renderable values; anything missing → sane default.
function normalizeStyle(raw: Partial<RefStyle> | null | undefined): RefStyle | null {
  if (!raw || typeof raw !== "object") return null;
  const num = (v: unknown, d: number, lo: number, hi: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const pick = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (opts.includes(v as T) ? (v as T) : d);
  const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : d);
  const textColor = hex(raw.textColor, "#ffffff");
  return {
    dim: num(raw.dim, 0.2, 0, 0.8),
    scrim: pick(raw.scrim, ["none", "uniform", "top", "bottom", "text"] as const, "text"),
    textColor,
    accentColor: hex(raw.accentColor, textColor),
    textEffect: pick(raw.textEffect, ["shadow", "none"] as const, "shadow"),
    align: pick(raw.align, ["left", "center", "right"] as const, "left"),
    anchor: pick(raw.anchor, ["top", "center", "bottom", "free"] as const, "free"),
    headlineSize: num(raw.headlineSize, 68, 28, 160),
    bodySize: num(raw.bodySize, 34, 0, 80),
    headlineWeight: num(raw.headlineWeight, 700, 300, 900),
    letterCase: pick(raw.letterCase, ["lower", "sentence", "upper", "as-is"] as const, "as-is"),
    levels: Math.round(num(raw.levels, 2, 1, 4)),
    wordsPerSlide: Math.round(num(raw.wordsPerSlide, 12, 2, 80)),
    hierarchy: String(raw.hierarchy ?? ""),
    storyPattern: String(raw.storyPattern ?? ""),
    voice: String(raw.voice ?? ""),
  };
}

// Models occasionally return out-of-range photo numbers or the wrong slot
// count; clamp to what the renderer can draw so a plan is always usable.
export function normalizePlan(raw: Partial<Plan> & { cardCount?: number }, photoCount: number, fixedCount: number): Plan {
  let cards = (raw.cards ?? []).map((c): PlannedCard => {
    const layout: LayoutKind = LAYOUT_KINDS.includes(c?.layout as LayoutKind) ? (c.layout as LayoutKind) : "full";
    const slots = LAYOUT_SLOTS[layout].length;
    const photos = Array.from({ length: slots }, (_, i) => {
      const n = Math.round(Number(c?.photos?.[i] ?? 0));
      return n >= 1 && n <= photoCount ? n : 0;
    });
    return { layout, photos, idea: typeof c?.idea === "string" ? c.idea : "" };
  });
  if (fixedCount > 0 && cards.length) {
    while (cards.length < fixedCount) cards.push({ ...cards[cards.length - 1] });
    cards = cards.slice(0, fixedCount);
  }
  return {
    reply: String(raw.reply ?? ""),
    referenceLayout: String(raw.referenceLayout ?? ""),
    style: normalizeStyle(raw.style),
    cards: cards.slice(0, 12),
    sufficient: raw.sufficient !== false,
    needMore: Math.max(0, Math.round(Number(raw.needMore) || 0)),
    question: String(raw.question ?? ""),
    options: Array.isArray(raw.options) ? raw.options.map(String).slice(0, 4) : [],
  };
}

// Run one analysis pass; `onReply` receives the analysis text as it streams.
export async function runPlan(
  body: PlanBody,
  onReply: (text: string) => void,
): Promise<{ plan: Plan; usage?: UsageEvent }> {
  let acc = "";
  let doneText = "";
  let usage: UsageEvent | undefined;
  for await (const ev of streamPlan(body)) {
    if (ev.type === "delta") {
      acc += ev.text ?? "";
      onReply(extractReply(acc));
    } else if (ev.type === "error") {
      throw new Error(ev.error || "분석에 실패했습니다.");
    } else if (ev.type === "done") {
      doneText = ev.text || acc;
      usage = ev.usage;
    }
  }
  const raw = parseStructured<Partial<Plan> & { cardCount?: number }>(doneText || acc);
  return { plan: normalizePlan(raw, body.photos?.length ?? 0, body.cardCount ?? 0), usage };
}

// Photos needed by a plan (for the UI's "12 cuts needed" line).
export const slotsNeeded = (plan: Plan) => plan.cards.reduce((n, c) => n + LAYOUT_SLOTS[c.layout].length, 0);
