// Client-side image helpers for chat attachments.
import { sampleImageColors } from "./color";

export interface Attachment {
  id: string;
  dataUrl: string; // original — inserted into cards on request
  apiDataUrl: string; // resized copy sent to the model
  thumb: string; // tiny copy persisted in chat history
  width: number;
  height: number;
  url?: string; // same-origin /uploads URL once saved to the local store
  bg?: string; // detected backdrop color (hex) — for "separate the subject" edits
  bgUniform?: boolean; // true when the backdrop is a near-solid color
}

// Persist the full image to the local store (dev only) and return its /uploads
// URL, which is what gets referenced in cards. Falls back to the inline data URL
// if the server can't write (e.g., hosted) — still works, just not AI-reusable.
export async function uploadAttachment(dataUrl: string): Promise<string> {
  try {
    const res = await fetch("/api/asset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    if (res.ok) {
      const d = await res.json();
      if (typeof d.url === "string") return d.url;
    }
  } catch {
    /* fall through to the data URL */
  }
  return dataUrl;
}

function scaleToDataUrl(img: HTMLImageElement, maxDim: number): string {
  const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * ratio));
  const h = Math.max(1, Math.round(img.naturalHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export async function fileToAttachment(file: File): Promise<Attachment> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("이미지를 읽을 수 없습니다"));
    el.src = dataUrl;
  });
  const colors = await sampleImageColors(dataUrl).catch(() => null);
  return {
    id: crypto.randomUUID(),
    dataUrl,
    apiDataUrl: scaleToDataUrl(img, 1200),
    thumb: scaleToDataUrl(img, 160),
    width: img.naturalWidth,
    height: img.naturalHeight,
    bg: colors?.bg,
    bgUniform: colors?.uniform,
  };
}

export function splitDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  return m ? { mediaType: m[1], data: m[2] } : null;
}

const isHeic = (f: File) => /image\/hei[cf]/.test(f.type) || /\.hei[cf]$/i.test(f.name);

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("이미지를 읽을 수 없습니다"));
    el.src = src;
  });
}

// Decode any picked file into an <img>. HEIC goes through the local /api/heic
// converter first (browsers other than Safari can't decode it).
async function decodeFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } catch {
    if (!isHeic(file)) throw new Error(`${file.name}: 이미지를 읽을 수 없습니다`);
    const res = await fetch("/api/heic", { method: "POST", body: file });
    if (!res.ok) throw new Error(`${file.name}: HEIC는 JPG/PNG로 변환 후 넣어주세요`);
    const jpg = URL.createObjectURL(await res.blob());
    try {
      return await loadImage(jpg);
    } finally {
      URL.revokeObjectURL(jpg);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

// A photo for a photo-set generation: `full` (≤2160px — 2× export width) goes on
// the card, `api` (≤800px) is what the model looks at, `thumb` is for the tray.
export async function fileToGenPhoto(file: File): Promise<import("./types").GenPhoto> {
  const img = await decodeFile(file);
  return {
    id: crypto.randomUUID(),
    full: scaleToDataUrl(img, 2160),
    api: scaleToDataUrl(img, 800),
    thumb: scaleToDataUrl(img, 160),
  };
}

// A reference screenshot (script / insights): the model needs to READ it, so
// keep more resolution than photos.
export async function fileToRefImage(file: File): Promise<{ id: string; api: string; thumb: string }> {
  const img = await decodeFile(file);
  return { id: crypto.randomUUID(), api: scaleToDataUrl(img, 1400), thumb: scaleToDataUrl(img, 160) };
}

// Downscale any data URL (e.g. an Instagram slide) to a tiny thumbnail for the
// persisted chat history, which lives under the ~5MB storage budget.
export async function shrinkDataUrl(dataUrl: string, maxDim = 160): Promise<string> {
  return scaleToDataUrl(await loadImage(dataUrl), maxDim);
}

// An image already on a card / in /uploads, prepared for the model like a chat
// attachment (tagged via @사진N): resized copy + dims + a tiny history thumb.
export async function srcToModelImage(
  src: string,
): Promise<{ apiDataUrl: string; thumb: string; width: number; height: number }> {
  const img = await loadImage(src);
  return {
    apiDataUrl: scaleToDataUrl(img, 1000),
    thumb: scaleToDataUrl(img, 120),
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
}

export const IMAGE_ACCEPT = "image/*,.heic,.heif";

// Image files only (incl. HEIC, whose MIME type is often empty on macOS).
export function imageFiles(list: FileList | File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith("image/") || /\.hei[cf]$/i.test(f.name));
}
