import {
  ROLE_STYLE_KEYS,
  type Card,
  type CardElement,
  type Operation,
  type Project,
  type RoleStyle,
  type TextElement,
  type Theme,
} from "./types";

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

// Replace attachment:N placeholders — bare ("attachment:0") or inside a CSS
// url() in a card background — with the real src/URL from this turn's uploads.
function subst(s: string, attachments?: string[]): string {
  if (!attachments) return s;
  return s.replace(/attachment:(\d+)/g, (whole, n) => attachments[parseInt(n, 10)] ?? whole);
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
      role: typeof raw.role === "string" && raw.role ? raw.role : undefined,
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
      opacity: raw.opacity !== undefined ? num(raw.opacity, 1, 0, 1) : undefined,
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
      opacity: raw.opacity !== undefined ? num(raw.opacity, 1, 0, 1) : undefined,
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
      dim: raw.dim !== undefined ? num(raw.dim, 0, 0, 1) : undefined,
      opacity: raw.opacity !== undefined ? num(raw.opacity, 1, 0, 1) : undefined,
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
  return { id: newId(), background: subst(str(raw.background, theme.background), attachments), elements };
}

const TEXT_PATCH_KEYS = ["text", "role", "fontSize", "fontWeight", "color", "align", "lineHeight", "fontFamily", "letterSpacing", "opacity", "x", "y", "w"] as const;
const SHAPE_PATCH_KEYS = ["color", "radius", "opacity", "x", "y", "w", "h"] as const;
const IMAGE_PATCH_KEYS = ["fit", "radius", "dim", "opacity", "x", "y", "w", "h"] as const;

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

// --- text roles: shared typography per role -------------------------------

function coerceStyleValue(key: string, v: unknown): unknown {
  if (key === "color" || key === "fontFamily") return typeof v === "string" && v ? v : undefined;
  if (key === "align") return v === "left" || v === "center" || v === "right" ? v : undefined;
  const ranges: Record<string, [number, number]> = {
    fontSize: [8, 400],
    fontWeight: [100, 900],
    lineHeight: [0.8, 2.5],
    letterSpacing: [-0.2, 1],
  };
  const r = ranges[key];
  if (!r) return undefined;
  const n = num(v, NaN, r[0], r[1]);
  return Number.isFinite(n) ? n : undefined;
}

function textEls(project: Project, role: string): TextElement[] {
  return project.cards
    .flatMap((c) => c.elements)
    .filter((e): e is TextElement => e.type === "text" && e.role === role);
}

// The style a role should use: the most common value per field among its text
// elements (mode). Establishes a shared style from possibly-inconsistent cards.
function canonicalRoleStyle(project: Project, role: string): RoleStyle {
  const style: RoleStyle = {};
  const els = textEls(project, role);
  for (const key of ROLE_STYLE_KEYS) {
    const counts = new Map<string, { v: unknown; n: number }>();
    for (const el of els) {
      const v = (el as unknown as Record<string, unknown>)[key];
      if (v === undefined) continue;
      const c = counts.get(String(v));
      if (c) c.n++;
      else counts.set(String(v), { v, n: 1 });
    }
    let best: { v: unknown; n: number } | undefined;
    for (const c of counts.values()) if (!best || c.n > best.n) best = c;
    if (best) (style as Record<string, unknown>)[key] = best.v;
  }
  return style;
}

function assignStyle(el: TextElement, style: RoleStyle) {
  const t = el as unknown as Record<string, unknown>;
  for (const key of ROLE_STYLE_KEYS) {
    if (style[key] !== undefined) t[key] = style[key];
  }
}

// Change a role's shared style and push each changed field to same-role text
// that was still IN SYNC (== old shared value) — so per-card overrides survive.
// Mutates `p`. Used by the update_style op and the inspector's shared editor.
function applyRoleStyleInPlace(p: Project, role: string, patch: Record<string, unknown>) {
  const styles = (p.styles = { ...(p.styles ?? {}) });
  const old = styles[role] ?? {};
  const next: RoleStyle = { ...old };
  for (const key of ROLE_STYLE_KEYS) {
    const nv = coerceStyleValue(key, patch[key]);
    if (nv === undefined) continue;
    const ov = (old as Record<string, unknown>)[key];
    (next as Record<string, unknown>)[key] = nv;
    for (const el of textEls(p, role)) {
      const cur = (el as unknown as Record<string, unknown>)[key];
      if (ov === undefined || cur === ov) (el as unknown as Record<string, unknown>)[key] = nv;
    }
  }
  styles[role] = next;
}

export function applyRoleStyle(project: Project, role: string, patch: Record<string, unknown>): Project {
  const p = structuredClone(project);
  applyRoleStyleInPlace(p, role, patch);
  p.updatedAt = Date.now();
  return p;
}

// The style to SHOW for a role: the saved shared style, falling back per field to
// the current elements' most-common value — so the panel is never blank even
// before project.styles has been established.
export function roleSharedStyle(project: Project, role: string): RoleStyle {
  return { ...canonicalRoleStyle(project, role), ...(project.styles?.[role] ?? {}) };
}

// Force every same-role text element to the role's shared style — used after
// generation and by an explicit "unify" action so cards can't drift apart.
// Establishes project.styles[role] (existing shared value wins, else the mode).
export function enforceRoles(project: Project): Project {
  const p = structuredClone(project);
  const roles = new Set<string>();
  for (const c of p.cards) for (const e of c.elements) if (e.type === "text" && e.role) roles.add(e.role);
  const styles: Record<string, RoleStyle> = { ...(p.styles ?? {}) };
  for (const role of roles) {
    const shared = styles[role] ?? canonicalRoleStyle(p, role);
    styles[role] = shared;
    for (const el of textEls(p, role)) assignStyle(el, shared);
  }
  p.styles = styles;
  return p;
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
          if (typeof o.patch[key] === "string") {
            p.theme[key] = key === "background" ? subst(o.patch[key] as string, attachments) : (o.patch[key] as string);
          }
        }
        break;
      }
      case "update_style": {
        // Change a role's shared typography → propagate to same-role text.
        if (o.role && o.patch) applyRoleStyleInPlace(p, o.role, o.patch);
        break;
      }
      case "update_card": {
        if (card && typeof o.patch?.background === "string") card.background = subst(o.patch.background, attachments);
        break;
      }
      case "update_element": {
        const el = card?.elements.find((e) => e.id === o.elementId);
        if (el && o.patch) {
          // Swapping an image's source: substitute attachment tokens + validate.
          if (el.type === "image" && typeof o.patch.src === "string") {
            const s = subst(o.patch.src, attachments);
            if (s.startsWith("data:") || s.startsWith("/")) el.src = s;
          }
          patchElement(el, o.patch);
        }
        break;
      }
      case "add_element": {
        if (!card || !o.element) break;
        const el = normalizeElement(o.element, p.theme, attachments);
        // Stacking = array order (index 0 = back). `index` lets the AI drop a
        // background image behind everything instead of on top.
        if (el) {
          const at =
            o.index !== undefined ? Math.min(Math.max(0, o.index), card.elements.length) : card.elements.length;
          card.elements.splice(at, 0, el);
        }
        break;
      }
      case "remove_element": {
        if (card) card.elements = card.elements.filter((e) => e.id !== o.elementId);
        break;
      }
      case "reorder_element": {
        if (!card) break;
        const from = card.elements.findIndex((e) => e.id === o.elementId);
        if (from < 0) break;
        const [el] = card.elements.splice(from, 1);
        const to =
          o.index !== undefined ? Math.min(Math.max(0, o.index), card.elements.length) : card.elements.length;
        card.elements.splice(to, 0, el);
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
