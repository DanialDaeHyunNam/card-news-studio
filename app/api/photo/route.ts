import { NextRequest, NextResponse } from "next/server";

// Same-origin proxy for Lorem Picsum photos (see lib/photos.ts). Keeps
// AI-picked card backgrounds on our origin so html-to-image export never
// hits CORS, and lets us cache aggressively (picsum photos are immutable).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = Number(sp.get("id"));
  const w = Math.min(2000, Math.max(16, Number(sp.get("w")) || 1080));
  const h = Math.min(2000, Math.max(16, Number(sp.get("h")) || 1080));
  if (!Number.isInteger(id) || id < 0 || id > 1100) {
    return NextResponse.json({ error: "invalid photo id" }, { status: 400 });
  }
  const grayscale = sp.get("g") === "1" ? "?grayscale" : "";

  const upstream = await fetch(`https://picsum.photos/id/${id}/${w}/${h}${grayscale}`);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `photo fetch failed (${upstream.status})` }, { status: 502 });
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
