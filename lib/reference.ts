// A public social post used as a FORMAT reference (Instagram / LinkedIn /
// TikTok), fetched server-side by /api/reference. Isomorphic: the type and URL
// detection are shared by the create wizard, the editor chat and the prompt
// builders. When scraping fails, the UI asks for screenshots instead
// (`screenshotReference`), which produce the same shape with platform "upload".

export type RefPlatform = "instagram" | "linkedin" | "tiktok" | "upload";

export interface ReferencePost {
  platform: RefPlatform;
  url: string;
  author: string;
  caption: string; // post text / description
  kind: "carousel" | "document" | "video" | "image" | "text";
  slides: string[]; // data URLs, in order (≤10)
  slideTexts?: string[]; // per-slide text when the platform exposes it (LinkedIn documents)
  transcript?: string; // video subtitles when available (TikTok)
  totalSlides: number;
  stats: { likes?: number; comments?: number; plays?: number; shares?: number; saves?: number };
  partial?: boolean; // fell back to a thinner source (e.g. TikTok oEmbed)
}

const RE: Record<Exclude<RefPlatform, "upload">, RegExp> = {
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/[\w-]{5,}[^\s]*/,
  linkedin: /https?:\/\/(?:[\w-]+\.)?linkedin\.com\/(?:posts|feed\/update|pulse)\/[^\s]+/,
  tiktok: /https?:\/\/(?:(?:www|m|vm|vt)\.)?tiktok\.com\/[^\s]+/,
};

export function detectReference(text: string): { platform: Exclude<RefPlatform, "upload">; url: string } | null {
  for (const platform of ["instagram", "linkedin", "tiktok"] as const) {
    const m = RE[platform].exec(text);
    if (m) return { platform, url: m[0] };
  }
  return null;
}

export const PLATFORM_LABEL: Record<RefPlatform, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  upload: "Screenshots",
};

export async function fetchReference(url: string): Promise<ReferencePost> {
  const res = await fetch("/api/reference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = (await res.json().catch(() => ({}))) as ReferencePost & { error?: string };
  if (!res.ok) throw new Error(data.error || "게시물을 읽지 못했습니다.");
  return data;
}

// Fallback when scraping fails: the user's own screenshots of the post.
export function screenshotReference(slides: string[], url = "", caption = ""): ReferencePost {
  return {
    platform: "upload",
    url,
    author: "",
    caption,
    kind: slides.length > 1 ? "carousel" : "image",
    slides,
    totalSlides: slides.length,
    stats: {},
  };
}
