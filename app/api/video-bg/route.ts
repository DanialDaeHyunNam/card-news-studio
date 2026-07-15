import { NextResponse } from "next/server";
import { streamResponse } from "@/lib/ai";
import { buildVideoBgRequest } from "@/lib/requests";

export const maxDuration = 60;

// Picks the best video frame to use as a card background, WITHOUT downloading the
// video: it sends the free YouTube thumbnail frames (poster + 3 auto-sampled) to
// the vision model and asks which reads best behind text, plus a matching accent.
// Streams the small {frame, accent} object as SSE (client parses like generate/chat).
// Prompt/schema live in lib/requests.ts, shared with the hosted BYOK path (which
// fetches the same frames through /api/frame instead).
const FRAME_URLS = (v: string) => [
  `https://i.ytimg.com/vi/${v}/maxresdefault.jpg`, // 0 (falls back below)
  `https://i.ytimg.com/vi/${v}/hq1.jpg`, // 1
  `https://i.ytimg.com/vi/${v}/hq2.jpg`, // 2
  `https://i.ytimg.com/vi/${v}/hq3.jpg`, // 3
];

async function fetchB64(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer()).toString("base64");
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: { videoId?: string; model?: string; lang?: "ko" | "en" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const v = body.videoId ?? "";
  if (!/^[\w-]{11}$/.test(v)) {
    return NextResponse.json({ error: "videoId가 필요합니다." }, { status: 400 });
  }

  // Poster (0) falls back to hqdefault; frames 1..3 are the auto-sampled thumbs.
  const urls = FRAME_URLS(v);
  const b64s = await Promise.all([
    fetchB64(urls[0]).then((r) => r ?? fetchB64(`https://i.ytimg.com/vi/${v}/hqdefault.jpg`)),
    fetchB64(urls[1]),
    fetchB64(urls[2]),
    fetchB64(urls[3]),
  ]);
  const frames = b64s
    .map((b64, index) => (b64 ? { index, b64 } : null))
    .filter((f): f is { index: number; b64: string } => f !== null);
  if (frames.length === 0) {
    return NextResponse.json({ error: "영상 프레임을 가져오지 못했습니다." }, { status: 502 });
  }

  return streamResponse(buildVideoBgRequest(frames, body.model));
}
