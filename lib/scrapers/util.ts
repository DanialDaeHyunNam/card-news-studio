// Server-only helpers shared by the reference scrapers.
export const CRAWLER_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
export const MAX_SLIDES = 10;

// Read the balanced JSON value ({…} or […]) starting at s[start].
export function readBalanced(s: string, start: number): string | null {
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

export async function getText(url: string, ua: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": ua, "accept-language": "ko,en;q=0.8" }, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function toDataUrl(url: string, ua = BROWSER_UA): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "user-agent": ua } });
    if (!r.ok) return null;
    const type = r.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    if (!/^image\/(jpeg|png|webp)$/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function downloadAll(urls: string[], ua?: string): Promise<string[]> {
  const out = await Promise.all(urls.slice(0, MAX_SLIDES).map((u) => toDataUrl(u, ua)));
  return out.filter((d): d is string => !!d);
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

export function metaContent(html: string, property: string): string {
  const m = new RegExp(`<meta[^>]+(?:property|name)="${property}"[^>]+content="([^"]*)"`).exec(html);
  return m ? decodeEntities(m[1]) : "";
}
