import { NextRequest, NextResponse } from "next/server";

// Same-origin proxy for YouTube thumbnail frames — the poster and the three
// auto-sampled frames (start/middle/end). Keeps a video-frame card background on
// our origin so html-to-image export never hits CORS, and lets us cache hard
// (these thumbnails are immutable per video). No video is downloaded: these are
// the free thumbnail images YouTube already serves.
const FILES = ["maxresdefault", "hq1", "hq2", "hq3"] as const; // n = 0..3

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const v = sp.get("v") ?? "";
  const n = Number(sp.get("n"));
  if (!/^[\w-]{11}$/.test(v) || !Number.isInteger(n) || n < 0 || n >= FILES.length) {
    return NextResponse.json({ error: "invalid frame ref" }, { status: 400 });
  }

  // maxresdefault can 404 on some videos → fall back to hqdefault (always exists).
  const candidates =
    n === 0
      ? [`https://i.ytimg.com/vi/${v}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${v}/hqdefault.jpg`]
      : [`https://i.ytimg.com/vi/${v}/${FILES[n]}.jpg`];

  for (const url of candidates) {
    const upstream = await fetch(url);
    if (upstream.ok && upstream.body) {
      return new Response(upstream.body, {
        headers: {
          "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }
  return NextResponse.json({ error: "frame fetch failed" }, { status: 502 });
}
