import type { Card, CardElement } from "./types";
import { newId } from "./ops";

// Photo-set dressing: card k gets photo k mod N (N == M → one each; N < M →
// 1..N,1..N,…; N > M → the first M), laid full-bleed at the back, plus a
// gradient scrim on whichever half holds the text, plus text shadows. The model
// only writes text — it was shown each photo to place the copy off the subject.
// How the reference treats photos + text, read by the analysis step
// (planSchema.style). Drives BOTH the prompt (text color/size/case/position/
// story) and this client dressing (dim + scrim + text effect), so the set looks
// like the reference instead of one house style. Absent → the defaults below.
export interface RefStyle {
  dim: number; // 0–0.8 uniform darkening of each photo
  scrim: "none" | "uniform" | "top" | "bottom" | "text"; // extra gradient; "text" = behind the text block
  textColor: string;
  accentColor: string;
  textEffect: "shadow" | "none";
  align: "left" | "center" | "right";
  anchor: "top" | "center" | "bottom" | "free"; // where text sits in its photo/slot
  headlineSize: number; // px at 1080 width
  bodySize: number; // 0 = the reference has no body line
  headlineWeight: number;
  letterCase: "lower" | "sentence" | "upper" | "as-is";
  levels: number; // text levels per slide (1 = one line only, 2 = title + body, …)
  wordsPerSlide: number;
  hierarchy: string; // free-text read of the type hierarchy
  storyPattern: string; // narrative structure / devices (refrain, contrast, numbering…)
  voice: string; // tone & wording habits
}

const SCRIM = "rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0) 100%";

export function dressPhotoCard(card: Card, k: number, urls: string[], style?: RefStyle): Card {
  const shadow = style ? style.textEffect === "shadow" : true;
  const texts = card.elements.filter((e) => e.type === "text").map((e) => ({ ...e, shadow }));
  const others = card.elements.filter((e) => e.type === "shape");
  const ys = texts.map((e) => e.y);
  const top = ys.length ? Math.min(...ys) : 70;
  const bottom = ys.length ? Math.max(...ys) : 70;
  const scrimMode = style?.scrim ?? "text";
  const upper = scrimMode === "top" || (scrimMode === "text" && (top + bottom) / 2 < 45);
  const scrimY = upper ? 0 : Math.min(75, Math.max(25, top - 18));
  const scrimH = upper ? Math.min(75, Math.max(30, bottom + 26)) : 100 - scrimY;
  const photo: CardElement = {
    id: newId(),
    type: "image",
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    src: urls[k % urls.length],
    fit: "cover",
    radius: 0,
    dim: style ? style.dim : 0.12,
  };
  const layers: CardElement[] = [photo];
  if (scrimMode === "text" || scrimMode === "top" || scrimMode === "bottom") {
    layers.push({
      id: newId(),
      type: "shape",
      x: 0,
      y: scrimY,
      w: 100,
      h: scrimH,
      radius: 0,
      color: `linear-gradient(${upper ? "180deg" : "0deg"}, ${SCRIM})`,
    });
  }
  return { ...card, background: "#111111", elements: [...layers, ...others, ...texts] };
}

// ---------------------------------------------------------------- planned layouts
// A plan (lib/harness.ts, from the analysis step) gives each card a photo
// layout copied from the reference's composition — e.g. two different photos
// stacked top/bottom with a caption on each — and assigns specific photos to
// each slot. Rects are percent of the card.
export type LayoutKind = "full" | "stack2" | "side2" | "stack3" | "grid4" | "none";
export interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const LAYOUT_SLOTS: Record<LayoutKind, Slot[]> = {
  full: [{ x: 0, y: 0, w: 100, h: 100 }],
  stack2: [
    { x: 0, y: 0, w: 100, h: 50 },
    { x: 0, y: 50, w: 100, h: 50 },
  ],
  side2: [
    { x: 0, y: 0, w: 50, h: 100 },
    { x: 50, y: 0, w: 50, h: 100 },
  ],
  stack3: [
    { x: 0, y: 0, w: 100, h: 33.34 },
    { x: 0, y: 33.33, w: 100, h: 33.34 },
    { x: 0, y: 66.66, w: 100, h: 33.34 },
  ],
  grid4: [
    { x: 0, y: 0, w: 50, h: 50 },
    { x: 50, y: 0, w: 50, h: 50 },
    { x: 0, y: 50, w: 50, h: 50 },
    { x: 50, y: 50, w: 50, h: 50 },
  ],
  none: [],
};
export const LAYOUT_KINDS = Object.keys(LAYOUT_SLOTS) as LayoutKind[];

export interface PlannedCard {
  layout: LayoutKind;
  photos: number[]; // 1-based user photo index per slot; 0 = no photo in that slot
  idea?: string; // what this card says (the planner's intent, fed to generation)
}

// Photo per slot, plus a light uniform dim on multi-photo cards (the text sits
// on each photo, reels-style) and the gradient scrim for single-photo cards.
export function dressPlannedCard(card: Card, plan: PlannedCard, urls: string[], style?: RefStyle): Card {
  const slots = LAYOUT_SLOTS[plan.layout] ?? [];
  const shadow = style ? style.textEffect === "shadow" : true;
  const texts = card.elements.filter((e) => e.type === "text").map((e) => ({ ...e, shadow }));
  const shapes = card.elements.filter((e) => e.type === "shape");
  if (plan.layout === "full" && plan.photos[0] > 0 && urls[plan.photos[0] - 1]) {
    // Reuse the single-photo treatment (scrim on the text's half) with this exact photo.
    return dressPhotoCard(card, 0, [urls[plan.photos[0] - 1]], style);
  }
  const photos: CardElement[] = [];
  slots.forEach((slot, i) => {
    const src = urls[(plan.photos[i] ?? 0) - 1];
    if (!src) return;
    photos.push({ id: newId(), type: "image", ...slot, src, fit: "cover", radius: 0, dim: style ? style.dim : 0.22 });
  });
  if (!photos.length) return card; // text-only card (e.g. a closing slide)
  return { ...card, background: "#111111", elements: [...photos, ...shapes, ...texts] };
}
