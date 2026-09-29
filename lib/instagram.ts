// Client helper for /api/instagram — shared by the Home hero (generate from a
// reference post) and the editor chat (restyle cards after a reference post).
import type { InstagramRef } from "./requests";

export const IG_URL_RE = /https?:\/\/(?:www\.)?instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/[\w-]{5,}[^\s]*/;

export function findInstagramUrl(text: string): string | null {
  return IG_URL_RE.exec(text)?.[0] ?? null;
}

export async function fetchInstagram(url: string): Promise<InstagramRef> {
  const res = await fetch("/api/instagram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = (await res.json().catch(() => ({}))) as InstagramRef & { error?: string };
  if (!res.ok) throw new Error(data.error || "인스타 게시물을 읽지 못했습니다.");
  return data;
}
