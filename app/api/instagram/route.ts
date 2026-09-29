import { NextResponse } from "next/server";
import type { InstagramRef } from "@/lib/requests";

export const maxDuration = 60;

// Public Instagram post → slides + caption + counts, without login. The normal
// web page is a login-walled SPA, but Instagram serves crawlers (Googlebot UA)
// the post's full media JSON inline — including every `carousel_media` child.
// Verified 2026-09: the GraphQL doc_id endpoint answers 403, the embed page
// carries no media, `?__a=1` 500s; the crawler page works. Best effort: if
// Instagram changes this, the route fails loudly and the user can paste
// screenshots as reference images instead.
const IG_RE = /instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]{5,})/;
const CRAWLER_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const MAX_SLIDES = 10;

// Read the balanced JSON value ({…} or […]) starting at s[start].
function readBalanced(s: string, start: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

// The JSON value of `"key":` found within [from, from+window).
function valueAfter<T>(s: string, key: string, from: number, window = 6000): T | null {
  const at = s.indexOf(`"${key}":`, from);
  if (at < 0 || at > from + window) return null;
  const start = at + key.length + 3;
  const raw = readBalanced(s, start);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function numberNear(s: string, key: string, from: number, to: number): number | undefined {
  const m = new RegExp(`"${key}":(\\d+)`).exec(s.slice(from, to));
  return m ? Number(m[1]) : undefined;
}

interface Candidate {
  url: string;
}
interface MediaItem {
  image_versions2?: { candidates?: Candidate[] };
}

// Candidates carry no reliable width field; the size is in the `stp` param.
// ~720px is plenty for the model to read the slide.
function pickUrl(item: MediaItem): string | null {
  const c = item.image_versions2?.candidates ?? [];
  const bySize = (tag: string) => c.find((x) => x.url.includes(tag))?.url;
  return bySize("s720x720") ?? bySize("s1080x1080") ?? bySize("s640x640") ?? c[0]?.url ?? null;
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "user-agent": CRAWLER_UA } });
    if (!r.ok) return null;
    const type = r.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    if (!/^image\/(jpeg|png|webp)$/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let url = "";
  try {
    url = String((await req.json()).url ?? "");
  } catch {
    /* fall through to validation */
  }
  const code = IG_RE.exec(url)?.[1];
  if (!code) {
    return NextResponse.json({ error: "유효한 Instagram 게시물 링크가 아닙니다." }, { status: 400 });
  }

  let html = "";
  try {
    const res = await fetch(`https://www.instagram.com/p/${code}/`, {
      headers: { "user-agent": CRAWLER_UA, "accept-language": "ko,en;q=0.8" },
    });
    html = await res.text();
  } catch {
    return NextResponse.json({ error: "Instagram에 연결하지 못했습니다." }, { status: 502 });
  }

  // The page embeds several posts (related ones too). The target is the
  // occurrence of its code that carries media right after it.
  let items: MediaItem[] | null = null;
  let kind: InstagramRef["kind"] = "image";
  let anchor = -1;
  for (let at = html.indexOf(`"code":"${code}"`); at >= 0; at = html.indexOf(`"code":"${code}"`, at + 1)) {
    const carousel = valueAfter<MediaItem[]>(html, "carousel_media", at, 4000);
    if (carousel?.length) {
      items = carousel;
      kind = "carousel";
      anchor = at;
      break;
    }
    const single = valueAfter<MediaItem["image_versions2"]>(html, "image_versions2", at, 4000);
    if (single?.candidates?.length && !items) {
      items = [{ image_versions2: single }];
      anchor = at;
    }
  }
  if (!items || anchor < 0) {
    return NextResponse.json(
      { error: "게시물을 읽지 못했습니다 (비공개 계정이거나 Instagram이 막았을 수 있어요). 슬라이드를 캡처해서 참고 이미지로 넣어주세요." },
      { status: 422 },
    );
  }

  const win = html.slice(Math.max(0, anchor - 6000), anchor + 6000);
  if (kind !== "carousel" && /"product_type":"clips"|"media_type":2/.test(win)) kind = "reel";
  // Carousel children carry `"caption":null`; the post's own caption object is
  // the first non-null one after the code (past the children's JSON).
  let caption = "";
  for (let at = html.indexOf('"caption":{', anchor); at >= 0 && at < anchor + 120000; at = html.indexOf('"caption":{', at + 1)) {
    const text = valueAfter<{ text?: string }>(html, "caption", at, 20)?.text;
    if (text) {
      caption = text;
      break;
    }
  }
  const username = /"username":"([\w.]+)"/.exec(win)?.[1] ?? "";

  const urls = items.map(pickUrl).filter((u): u is string => !!u).slice(0, MAX_SLIDES);
  const slides = (await Promise.all(urls.map(toDataUrl))).filter((d): d is string => !!d);
  if (slides.length === 0) {
    return NextResponse.json({ error: "슬라이드 이미지를 내려받지 못했습니다." }, { status: 502 });
  }

  const ref: InstagramRef = {
    url: `https://www.instagram.com/p/${code}/`,
    username,
    caption,
    likeCount: numberNear(html, "like_count", anchor - 6000, anchor + 6000),
    commentCount: numberNear(html, "comment_count", anchor - 6000, anchor + 6000),
    playCount: numberNear(html, "play_count", anchor - 6000, anchor + 6000),
    kind,
    slides,
    totalSlides: items.length,
  };
  return NextResponse.json(ref);
}
