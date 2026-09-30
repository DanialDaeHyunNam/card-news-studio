// LinkedIn: public post pages are served to crawlers with a schema.org ld+json
// block (text + like/comment counts). "Carousels" are document (PDF) posts:
// the page's `data-native-document-config` holds a manifest URL → per-resolution
// image manifests (every page as an image) + a transcript manifest (every
// page's text). Verified 2026-09 on a 12-page document post.
import type { ReferencePost } from "../reference";
import { BROWSER_UA, CRAWLER_UA, decodeEntities, downloadAll, getText, MAX_SLIDES, metaContent } from "./util";

interface LdPost {
  "@type"?: string;
  text?: string;
  articleBody?: string;
  headline?: string;
  author?: { name?: string };
  creator?: { name?: string };
  image?: { url?: string } | string;
  interactionStatistic?: { interactionType: string; userInteractionCount: number }[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "user-agent": BROWSER_UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function documentPages(html: string): Promise<{ slides: string[]; texts?: string[]; total: number } | null> {
  for (const m of html.matchAll(/data-native-document-config="([^"]*)"/g)) {
    let doc: { manifestUrl?: string; totalPageCount?: string } | undefined;
    try {
      doc = JSON.parse(decodeEntities(m[1])).doc;
    } catch {
      continue;
    }
    if (!doc?.manifestUrl) continue;
    const manifest = await getJson<{
      perResolutions?: { width: number; imageManifestUrl: string }[];
      transcriptManifestUrl?: string;
    }>(doc.manifestUrl);
    // ~800px pages: readable for the model without shipping 2k images.
    const res = (manifest.perResolutions ?? []).sort((a, b) => a.width - b.width);
    const pick = res.find((r) => r.width >= 600) ?? res.at(-1);
    if (!pick) return null;
    const { pages = [] } = await getJson<{ pages?: string[] }>(pick.imageManifestUrl);
    let texts: string[] | undefined;
    if (manifest.transcriptManifestUrl) {
      texts = (await getJson<{ pages?: string[] }>(manifest.transcriptManifestUrl).catch(() => ({ pages: undefined }))).pages;
    }
    return {
      slides: await downloadAll(pages.slice(0, MAX_SLIDES)),
      texts: texts?.slice(0, MAX_SLIDES),
      total: Number(doc.totalPageCount) || pages.length,
    };
  }
  return null;
}

export async function scrapeLinkedIn(url: string): Promise<ReferencePost> {
  const html = await getText(url, CRAWLER_UA);
  let post: LdPost | null = null;
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1]) as LdPost;
      if (d.text || d.articleBody || d.headline) {
        post = d;
        break;
      }
    } catch {
      /* next block */
    }
  }
  if (!post) throw new Error("LinkedIn 게시물을 읽지 못했습니다 (로그인 전용이거나 링크가 게시물이 아닐 수 있어요).");

  const stat = (type: string) =>
    post!.interactionStatistic?.find((s) => s.interactionType.endsWith(type))?.userInteractionCount;
  const doc = await documentPages(html).catch(() => null);
  let slides = doc?.slides ?? [];
  let kind: ReferencePost["kind"] = doc?.slides.length ? "document" : "text";
  if (!slides.length) {
    // Image posts: the post's own images are "feedshare-shrink" assets (avatars aren't).
    const imgs = [...html.matchAll(/(https:\/\/media\.licdn\.com\/dms\/image\/[^"'\s]*feedshare-shrink[^"'\s]*)/g)].map((m) =>
      decodeEntities(m[1]),
    );
    const og = metaContent(html, "og:image");
    slides = await downloadAll([...new Set(imgs.length ? imgs : og ? [og] : [])]);
    if (slides.length) kind = slides.length > 1 ? "carousel" : "image";
  }
  if (post["@type"] === "VideoObject") kind = "video";

  return {
    platform: "linkedin",
    url: url.split("?")[0],
    author: post.author?.name ?? post.creator?.name ?? "",
    caption: (post.text ?? post.articleBody ?? post.headline ?? "").trim(),
    kind,
    slides,
    slideTexts: doc?.texts,
    totalSlides: doc?.total ?? slides.length,
    stats: { likes: stat("LikeAction"), comments: stat("CommentAction") },
  };
}
