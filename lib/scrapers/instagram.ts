// Instagram: the web page is a login-walled SPA, but crawlers (Googlebot UA)
// get the post's full media JSON inline — including every `carousel_media`
// child. Verified 2026-09: GraphQL doc_id → 403, embed page → no media,
// `?__a=1` → 500.
import type { ReferencePost } from "../reference";
import { CRAWLER_UA, downloadAll, getText, readBalanced } from "./util";

const CODE_RE = /instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]{5,})/;

function valueAfter<T>(s: string, key: string, from: number, window = 6000): T | null {
  const at = s.indexOf(`"${key}":`, from);
  if (at < 0 || at > from + window) return null;
  const raw = readBalanced(s, at + key.length + 3);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const numberNear = (s: string, key: string, from: number, to: number) => {
  const m = new RegExp(`"${key}":(\\d+)`).exec(s.slice(Math.max(0, from), to));
  return m ? Number(m[1]) : undefined;
};

interface MediaItem {
  image_versions2?: { candidates?: { url: string }[] };
}

// Candidates carry no width field; the size is in the `stp` param. `pWxH` =
// fit proportionally inside the box (keeps the slide's real 4:5 / 9:16 shape);
// `sWxH` = a SQUARE CROP — never use it, it skews both the ratio suggestion and
// what the model sees (verified 2026-09: a 837×1046 slide came back 640×640).
function pickUrl(item: MediaItem): string | null {
  const c = item.image_versions2?.candidates ?? [];
  const byTag = (tag: string) => c.find((x) => x.url.includes(tag))?.url;
  const original = c.find((x) => !/[_=]s\d+x\d+/.test(x.url) && !/[_=]p\d+x\d+/.test(x.url))?.url;
  return byTag("p720x720") ?? byTag("p1080x1080") ?? byTag("p640x640") ?? original ?? c[0]?.url ?? null;
}

export async function scrapeInstagram(url: string): Promise<ReferencePost> {
  const code = CODE_RE.exec(url)?.[1];
  if (!code) throw new Error("유효한 Instagram 게시물 링크가 아닙니다.");
  const html = await getText(`https://www.instagram.com/p/${code}/`, CRAWLER_UA);

  // The page embeds related posts too; the target is the occurrence of its
  // code that carries media right after it.
  let items: MediaItem[] | null = null;
  let carousel = false;
  let anchor = -1;
  for (let at = html.indexOf(`"code":"${code}"`); at >= 0; at = html.indexOf(`"code":"${code}"`, at + 1)) {
    const children = valueAfter<MediaItem[]>(html, "carousel_media", at, 4000);
    if (children?.length) {
      items = children;
      carousel = true;
      anchor = at;
      break;
    }
    const single = valueAfter<MediaItem["image_versions2"]>(html, "image_versions2", at, 4000);
    if (single?.candidates?.length && !items) {
      items = [{ image_versions2: single }];
      anchor = at;
    }
  }
  if (!items) throw new Error("게시물을 읽지 못했습니다 (비공개이거나 Instagram이 막았을 수 있어요).");

  const win = html.slice(Math.max(0, anchor - 6000), anchor + 6000);
  const video = !carousel && /"product_type":"clips"|"media_type":2/.test(win);
  // Carousel children carry `"caption":null`; the post's own caption is the
  // first non-null caption object after the code (past the children's JSON).
  let caption = "";
  for (let at = html.indexOf('"caption":{', anchor); at >= 0 && at < anchor + 120000; at = html.indexOf('"caption":{', at + 1)) {
    const text = valueAfter<{ text?: string }>(html, "caption", at, 20)?.text;
    if (text) {
      caption = text;
      break;
    }
  }
  const slides = await downloadAll(items.map(pickUrl).filter((u): u is string => !!u), CRAWLER_UA);
  if (slides.length === 0) throw new Error("슬라이드 이미지를 내려받지 못했습니다.");

  return {
    platform: "instagram",
    url: `https://www.instagram.com/p/${code}/`,
    author: /"username":"([\w.]+)"/.exec(win)?.[1] ?? "",
    caption,
    kind: carousel ? "carousel" : video ? "video" : "image",
    slides,
    totalSlides: items.length,
    stats: {
      likes: numberNear(html, "like_count", anchor - 6000, anchor + 6000),
      comments: numberNear(html, "comment_count", anchor - 6000, anchor + 6000),
      plays: numberNear(html, "play_count", anchor - 6000, anchor + 6000),
    },
  };
}
