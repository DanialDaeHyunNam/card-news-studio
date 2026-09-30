import { NextResponse } from "next/server";
import { detectReference } from "@/lib/reference";
import { scrapeInstagram } from "@/lib/scrapers/instagram";
import { scrapeLinkedIn } from "@/lib/scrapers/linkedin";
import { scrapeTikTok } from "@/lib/scrapers/tiktok";

export const maxDuration = 60;

// Public social post (Instagram / LinkedIn / TikTok) → ReferencePost, no login.
// Best effort by design: any failure returns a readable error and the UI asks
// the user for screenshots of the post instead.
export async function POST(req: Request) {
  let url = "";
  try {
    url = String((await req.json()).url ?? "");
  } catch {
    /* fall through */
  }
  const ref = detectReference(url);
  if (!ref) {
    return NextResponse.json({ error: "Instagram·LinkedIn·TikTok 게시물 링크가 아닙니다." }, { status: 400 });
  }
  try {
    const scrape = { instagram: scrapeInstagram, linkedin: scrapeLinkedIn, tiktok: scrapeTikTok }[ref.platform];
    return NextResponse.json(await scrape(ref.url));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "게시물을 읽지 못했습니다." }, { status: 422 });
  }
}
