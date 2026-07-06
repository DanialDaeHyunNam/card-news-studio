// Figma-style smart guides: while dragging, snap the moving element's edges
// and center to other elements' edges/centers and to the card (0 / 50 / 100).
// All values are in card-percent; thresholds are converted from px by the caller.

export interface SnapInput {
  x: number;
  y: number;
  w: number;
  h: number; // measured height of the dragged element, in percent
  targetsV: number[]; // candidate x positions (other elements' left/center/right + card)
  targetsH: number[]; // candidate y positions
  thresholdV: number;
  thresholdH: number;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: { v: number[]; h: number[] };
}

function snapAxis(
  pos: number,
  size: number,
  targets: number[],
  threshold: number,
): { pos: number; guide: number | null } {
  const edges = [pos, pos + size / 2, pos + size]; // leading / center / trailing
  let best: { delta: number; target: number } | null = null;
  for (const target of targets) {
    for (const edge of edges) {
      const delta = target - edge;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
        best = { delta, target };
      }
    }
  }
  return best ? { pos: pos + best.delta, guide: best.target } : { pos, guide: null };
}

export function snapPosition(input: SnapInput): SnapResult {
  const sx = snapAxis(input.x, input.w, input.targetsV, input.thresholdV);
  const sy = snapAxis(input.y, input.h, input.targetsH, input.thresholdH);
  return {
    x: sx.pos,
    y: sy.pos,
    guides: { v: sx.guide !== null ? [sx.guide] : [], h: sy.guide !== null ? [sy.guide] : [] },
  };
}

// Collect snap targets from the live DOM: every element's left/center/right and
// top/middle/bottom (in percent of the card), plus the card's own thirds-free
// basics (edges + center).
export function collectTargets(
  cardEl: HTMLElement,
  excludeElementId: string,
): { targetsV: number[]; targetsH: number[]; rects: Map<string, { x: number; y: number; w: number; h: number }> } {
  const cardRect = cardEl.getBoundingClientRect();
  const targetsV: number[] = [0, 50, 100];
  const targetsH: number[] = [0, 50, 100];
  const rects = new Map<string, { x: number; y: number; w: number; h: number }>();
  cardEl.querySelectorAll<HTMLElement>("[data-el-id]").forEach((node) => {
    const id = node.dataset.elId!;
    const r = node.getBoundingClientRect();
    const rel = {
      x: ((r.left - cardRect.left) / cardRect.width) * 100,
      y: ((r.top - cardRect.top) / cardRect.height) * 100,
      w: (r.width / cardRect.width) * 100,
      h: (r.height / cardRect.height) * 100,
    };
    rects.set(id, rel);
    if (id === excludeElementId) return;
    targetsV.push(rel.x, rel.x + rel.w / 2, rel.x + rel.w);
    targetsH.push(rel.y, rel.y + rel.h / 2, rel.y + rel.h);
  });
  return { targetsV, targetsH, rects };
}
