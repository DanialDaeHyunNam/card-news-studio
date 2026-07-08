// Client-side color sampling. The key use: for a subject-on-a-solid-color photo
// (e.g. a person shot against a flat orange backdrop), read the backdrop color
// from the image's border ring. Set the card background to that same color and a
// shrunk copy of the image blends in — only the subject appears to float, so you
// can move it anywhere (bottom-right, smaller) without a cutout/segmentation step.

export interface ImageColors {
  bg: string; // hex — the border/backdrop color (average of the edge ring)
  accent: string; // hex — the most vivid color in the frame (a theme-accent hint)
  uniform: boolean; // true when the border ring is nearly one color (solid backdrop)
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

// HSV saturation×value, used to pick a punchy accent from the subject area.
function vividness(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  return sat * (max / 255);
}

// Load a same-origin image (data URL / /uploads / /api/photo / /templates) into
// a small canvas and read pixels. Returns null if it can't be read.
export async function sampleImageColors(src: string): Promise<ImageColors | null> {
  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = src;
  });
  if (!img || !img.naturalWidth) return null;

  const W = 64;
  const H = Math.max(1, Math.round((W * img.naturalHeight) / img.naturalWidth));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, W, H);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, W, H).data;
  } catch {
    return null; // tainted canvas (shouldn't happen for same-origin)
  }

  // Average an s×s patch anchored at (px,py).
  type RGB = [number, number, number];
  const patch = (px: number, py: number, s: number): RGB => {
    let r = 0, g = 0, b = 0, c = 0;
    for (let y = py; y < Math.min(H, py + s); y++)
      for (let x = px; x < Math.min(W, px + s); x++) {
        const i = (y * W + x) * 4;
        (r += data[i]), (g += data[i + 1]), (b += data[i + 2]), c++;
      }
    return [r / c, g / c, b / c];
  };
  const dist = (a: RGB, x: RGB) => Math.hypot(a[0] - x[0], a[1] - x[1], a[2] - x[2]);
  const mean = (cs: RGB[]): RGB => [
    cs.reduce((s, c) => s + c[0], 0) / cs.length,
    cs.reduce((s, c) => s + c[1], 0) / cs.length,
    cs.reduce((s, c) => s + c[2], 0) / cs.length,
  ];

  // Sample the four corners. For a centered subject, the backdrop is the set of
  // corners that AGREE — the subject usually pollutes only one or two of them
  // (a full-length portrait sits over the bottom corners), so averaging all four
  // muddies the color. Cluster the tightest-agreeing corners instead.
  const s = Math.max(4, Math.round(Math.min(W, H) * 0.14));
  const corners: RGB[] = [patch(0, 0, s), patch(W - s, 0, s), patch(0, H - s, s), patch(W - s, H - s, s)];
  let closest = Infinity, ci = 0, cj = 1;
  for (let i = 0; i < 4; i++)
    for (let j = i + 1; j < 4; j++) {
      const d = dist(corners[i], corners[j]);
      if (d < closest) (closest = d), (ci = i), (cj = j);
    }
  const TOL = 48;
  const seedMid = mean([corners[ci], corners[cj]]);
  const cluster = corners.filter((c) => dist(c, seedMid) < TOL);
  // Solid enough to "separate the subject" only when two corners closely agree.
  const uniform = closest < TOL;
  const [mr, mg, mb] = uniform ? mean(cluster) : mean([corners[ci], corners[cj]]);

  // Accent: the most vivid pixel anywhere (usually on the subject).
  let best = -1, ar = mr, ag = mg, ab = mb;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const v = vividness(r, g, b);
    if (v > best) (best = v), (ar = r), (ag = g), (ab = b);
  }

  return { bg: toHex(mr, mg, mb), accent: toHex(ar, ag, ab), uniform };
}
