import type { Card, CardElement, Operation, Project, Theme } from "./types";

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

export function newId(): string {
  return crypto.randomUUID();
}

// Turn an untyped element (from the AI or a saved file) into a valid CardElement.
// `attachments` maps "attachment:N" placeholders to real data URLs.
export function normalizeElement(
  raw: Record<string, unknown>,
  theme: Theme,
  attachments?: string[],
): CardElement | null {
  const type = raw.type;
  if (type === "text") {
    return {
      id: str(raw.id, newId()),
      type: "text",
      x: num(raw.x, 8, -50, 150),
      y: num(raw.y, 10, -50, 150),
      w: num(raw.w, 84, 2, 200),
      text: str(raw.text, "텍스트"),
      fontSize: num(raw.fontSize, 48, 8, 400),
      fontWeight: num(raw.fontWeight, 700, 100, 900),
      color: str(raw.color, theme.textColor),
      align: raw.align === "left" || raw.align === "right" ? raw.align : "center",
      lineHeight: num(raw.lineHeight, 1.35, 0.8, 2.5),
      fontFamily: typeof raw.fontFamily === "string" && raw.fontFamily ? raw.fontFamily : undefined,
      letterSpacing: raw.letterSpacing !== undefined ? num(raw.letterSpacing, 0, -0.2, 1) : undefined,
    };
  }
  if (type === "shape") {
    return {
      id: str(raw.id, newId()),
      type: "shape",
      x: num(raw.x, 8, -50, 150),
      y: num(raw.y, 10, -50, 150),
      w: num(raw.w, 30, 0.5, 200),
      h: num(raw.h, 1, 0.2, 200),
      color: str(raw.color, theme.accent),
      radius: num(raw.radius, 0, 0, 500),
    };
  }
  if (type === "image") {
    let src = str(raw.src, "");
    const m = /^attachment:(\d+)$/.exec(src);
    if (m && attachments) src = attachments[parseInt(m[1], 10)] ?? "";
    // data URLs (user uploads) or same-origin public assets (templates) only
    if (!src.startsWith("data:") && !src.startsWith("/")) return null;
    return {
      id: str(raw.id, newId()),
      type: "image",
      x: num(raw.x, 10, -50, 150),
      y: num(raw.y, 10, -50, 150),
      w: num(raw.w, 50, 2, 200),
      h: num(raw.h, 35, 2, 200),
      src,
      fit: raw.fit === "contain" ? "contain" : "cover",
      radius: num(raw.radius, 0, 0, 500),
    };
  }
  return null;
}

export function normalizeCard(
  raw: { background?: string; elements?: Record<string, unknown>[] },
  theme: Theme,
  attachments?: string[],
): Card {
  const elements = (raw.elements ?? [])
    .map((e) => normalizeElement(e, theme, attachments))
    .filter((e): e is CardElement => e !== null);
  return { id: newId(), background: str(raw.background, theme.background), elements };
}

const TEXT_PATCH_KEYS = ["text", "fontSize", "fontWeight", "color", "align", "lineHeight", "fontFamily", "letterSpacing", "x", "y", "w"] as const;
const SHAPE_PATCH_KEYS = ["color", "radius", "x", "y", "w", "h"] as const;
const IMAGE_PATCH_KEYS = ["fit", "radius", "x", "y", "w", "h"] as const;

function patchElement(el: CardElement, patch: Record<string, unknown>) {
  const keys: readonly string[] =
    el.type === "text" ? TEXT_PATCH_KEYS : el.type === "shape" ? SHAPE_PATCH_KEYS : IMAGE_PATCH_KEYS;
  const target = el as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = patch[key];
    if (!(key in patch) || value === undefined || value === null) continue;
    if (key === "align") {
      if (value === "left" || value === "center" || value === "right") target[key] = value;
    } else if (key === "fit") {
      if (value === "cover" || value === "contain") target[key] = value;
    } else if (typeof value === "number") {
      const current = target[key];
      target[key] = num(value, typeof current === "number" ? current : 0, -1000, 10000);
    } else if (typeof value === "string") {
      target[key] = value;
    }
  }
}

// Pure: returns a new Project with the operations applied. Unknown ids are
// skipped silently — the AI occasionally references stale state and one bad
// op should not discard the rest of the batch.
export function applyOperations(project: Project, ops: Operation[], attachments?: string[]): Project {
  const p: Project = structuredClone(project);
  for (const o of ops) {
    const card = o.cardId ? p.cards.find((c) => c.id === o.cardId) : undefined;
    switch (o.op) {
      case "update_theme": {
        if (!o.patch) break;
        for (const key of ["background", "textColor", "accent", "fontFamily"] as const) {
          if (typeof o.patch[key] === "string") p.theme[key] = o.patch[key] as string;
        }
        break;
      }
      case "update_card": {
        if (card && typeof o.patch?.background === "string") card.background = o.patch.background;
        break;
      }
      case "update_element": {
        const el = card?.elements.find((e) => e.id === o.elementId);
        if (el && o.patch) patchElement(el, o.patch);
        break;
      }
      case "add_element": {
        if (!card || !o.element) break;
        const el = normalizeElement(o.element, p.theme, attachments);
        if (el) card.elements.push(el);
        break;
      }
      case "remove_element": {
        if (card) card.elements = card.elements.filter((e) => e.id !== o.elementId);
        break;
      }
      case "add_card": {
        if (!o.card) break;
        const newCard = normalizeCard(o.card, p.theme, attachments);
        const at = o.index !== undefined ? Math.min(Math.max(0, o.index), p.cards.length) : p.cards.length;
        p.cards.splice(at, 0, newCard);
        break;
      }
      case "remove_card": {
        if (p.cards.length > 1) p.cards = p.cards.filter((c) => c.id !== o.cardId);
        break;
      }
    }
  }
  p.updatedAt = Date.now();
  return p;
}
