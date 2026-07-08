import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { streamResponse } from "@/lib/ai";

export const maxDuration = 60;

// Picks the best video frame to use as a card background, WITHOUT downloading the
// video: it sends the free YouTube thumbnail frames (poster + 3 auto-sampled) to
// the vision model and asks which reads best behind text, plus a matching accent.
// Streams the small {frame, accent} object as SSE (client parses like generate/chat).
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

const pickSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    frame: { type: "integer", minimum: -1, maximum: 3, description: "best background frame index, or -1 if none" },
    accent: { type: "string", description: "hex point color matching the frame mood, e.g. #7dd3fc" },
    reason: { type: "string" },
  },
  required: ["frame", "accent"],
};

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

  const content: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text:
        "아래는 한 영상에서 뽑은 프레임 4장입니다 (0=포스터, 1~3=영상 앞/중/뒤 샘플). " +
        "카드뉴스의 배경(딤 스크림을 얹고 그 위에 텍스트)을 얹기에 가장 좋은 프레임 하나를 고르세요. " +
        "인물/장면이 또렷하고 산만하지 않으며 어둡게 딤을 씌워도 분위기가 사는 것을 우선하고, " +
        "자막·워터마크·큰 로고가 박힌 프레임은 피하세요. 마땅한 게 없으면 frame=-1. " +
        "accent는 그 프레임 분위기에 어울리는 포인트 색(hex).",
    },
  ];
  let available = 0;
  b64s.forEach((b64, i) => {
    if (!b64) return;
    available++;
    content.push({ type: "text", text: `프레임 ${i}:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } });
  });
  if (available === 0) {
    return NextResponse.json({ error: "영상 프레임을 가져오지 못했습니다." }, { status: 502 });
  }

  return streamResponse({
    system:
      "당신은 카드뉴스 배경 큐레이터입니다. 주어진 프레임 중 배경으로 가장 좋은 하나를 고르고, " +
      "어울리는 포인트 색을 정합니다. 반드시 스키마에 맞는 JSON 하나만 출력하세요.",
    content,
    schema: pickSchema,
    model: body.model,
  });
}
