// TikTok: with a browser UA the post page embeds `__UNIVERSAL_DATA_FOR_REHYDRATION__`
// (caption, full stats incl. saves, cover, photo-carousel `imagePost`, and
// `subtitleInfos` WebVTT links when the video has captions). It's rate-limited
// and flips to a ~1.4KB bot wall intermittently (seen 2026-09), so fall back to
// the official oEmbed endpoint (caption + author + thumbnail).
import type { ReferencePost } from "../reference";
import { BROWSER_UA, downloadAll, getText } from "./util";

interface Item {
  desc?: string;
  author?: { uniqueId?: string; nickname?: string };
  stats?: { diggCount?: number; commentCount?: number; playCount?: number; shareCount?: number; collectCount?: number | string };
  video?: {
    cover?: string;
    originCover?: string;
    subtitleInfos?: { LanguageCodeName?: string; Url?: string; Format?: string }[];
  };
  imagePost?: { images?: { imageURL?: { urlList?: string[] } }[] };
}

// WebVTT → plain lines (drop header, cue timings, tags, repeats).
function vttToText(vtt: string): string {
  const lines: string[] = [];
  for (const raw of vtt.split(/\r?\n/)) {
    const l = raw.replace(/<[^>]+>/g, "").trim();
    if (!l || l === "WEBVTT" || /-->/.test(l) || /^\d+$/.test(l) || /^(NOTE|Kind:|Language:)/.test(l)) continue;
    if (lines.at(-1) !== l) lines.push(l);
  }
  return lines.join("\n");
}

async function fromPage(url: string): Promise<ReferencePost | null> {
  const html = await getText(url, BROWSER_UA).catch(() => "");
  const m = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) return null;
  let item: Item | undefined;
  try {
    item = JSON.parse(m[1])?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
  } catch {
    return null;
  }
  if (!item) return null;

  const photos = (item.imagePost?.images ?? []).map((i) => i.imageURL?.urlList?.[0]).filter((u): u is string => !!u);
  const cover = item.video?.originCover || item.video?.cover;
  const slides = await downloadAll(photos.length ? photos : cover ? [cover] : []);

  let transcript: string | undefined;
  const subs = item.video?.subtitleInfos ?? [];
  const sub =
    subs.find((s) => s.LanguageCodeName?.startsWith("ko")) ?? subs.find((s) => s.LanguageCodeName?.startsWith("en")) ?? subs[0];
  if (sub?.Url) {
    transcript = await fetch(sub.Url, { headers: { "user-agent": BROWSER_UA } })
      .then((r) => (r.ok ? r.text() : ""))
      .then(vttToText)
      .catch(() => undefined);
  }
  const s = item.stats ?? {};
  return {
    platform: "tiktok",
    url: url.split("?")[0],
    author: item.author?.uniqueId ?? item.author?.nickname ?? "",
    caption: item.desc ?? "",
    kind: photos.length ? "carousel" : "video",
    slides,
    transcript: transcript || undefined,
    totalSlides: photos.length || slides.length,
    stats: {
      likes: s.diggCount,
      comments: s.commentCount,
      plays: s.playCount,
      shares: s.shareCount,
      saves: s.collectCount !== undefined ? Number(s.collectCount) : undefined,
    },
  };
}

async function fromOEmbed(url: string): Promise<ReferencePost | null> {
  const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
    headers: { "user-agent": BROWSER_UA },
  }).catch(() => null);
  if (!res?.ok) return null;
  const d = (await res.json().catch(() => null)) as { title?: string; author_name?: string; thumbnail_url?: string } | null;
  if (!d?.title && !d?.thumbnail_url) return null;
  const slides = await downloadAll(d.thumbnail_url ? [d.thumbnail_url] : []);
  return {
    platform: "tiktok",
    url: url.split("?")[0],
    author: d.author_name ?? "",
    caption: d.title ?? "",
    kind: "video",
    slides,
    totalSlides: slides.length,
    stats: {},
    partial: true,
  };
}

export async function scrapeTikTok(url: string): Promise<ReferencePost> {
  const post = (await fromPage(url)) ?? (await fromOEmbed(url));
  if (!post) throw new Error("TikTok 게시물을 읽지 못했습니다 (TikTok이 일시적으로 막았을 수 있어요).");
  return post;
}
