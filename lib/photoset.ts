import type { Card, CardElement } from "./types";
import { newId } from "./ops";

// Photo-set dressing: card k gets photo k mod N (N == M → one each; N < M →
// 1..N,1..N,…; N > M → the first M), laid full-bleed at the back, plus a
// gradient scrim on whichever half holds the text, plus text shadows. The model
// only writes text — it was shown each photo to place the copy off the subject.
export function dressPhotoCard(card: Card, k: number, urls: string[]): Card {
  const texts = card.elements.filter((e) => e.type === "text").map((e) => ({ ...e, shadow: true }));
  const others = card.elements.filter((e) => e.type === "shape");
  const ys = texts.map((e) => e.y);
  const top = ys.length ? Math.min(...ys) : 70;
  const bottom = ys.length ? Math.max(...ys) : 70;
  const upper = (top + bottom) / 2 < 45;
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
    dim: 0.12,
  };
  const scrim: CardElement = {
    id: newId(),
    type: "shape",
    x: 0,
    y: scrimY,
    w: 100,
    h: scrimH,
    radius: 0,
    color: `linear-gradient(${upper ? "180deg" : "0deg"}, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0) 100%)`,
  };
  return { ...card, background: "#111111", elements: [photo, scrim, ...others, ...texts] };
}
