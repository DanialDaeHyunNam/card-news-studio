import { NextResponse } from "next/server";
import { streamResponse } from "@/lib/ai";
import { generateSystem } from "@/lib/prompts";
import { generateSchema } from "@/lib/schemas";
import { FORMATS, type Format, type Theme } from "@/lib/types";

export const maxDuration = 300;

interface GenerateBody {
  topic: string;
  format: Format;
  cardCount?: number;
  model?: string;
  lang?: "ko" | "en";
  accent?: string; // fixed brand point color (hex)
  reference?: { theme: Theme; sampleTexts: string[] };
  source?: { type: "youtube"; url: string; title: string; author: string; transcript: string };
}

export async function POST(req: Request) {
  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!body.topic?.trim() || !FORMATS[body.format]) {
    return NextResponse.json({ error: "topic과 format이 필요합니다." }, { status: 400 });
  }

  const parts = [
    `## 주제/원문\n${body.topic.trim()}`,
    `## 카드 수\n${Math.min(Math.max(body.cardCount ?? 6, 2), 12)}장 (훅 카드와 CTA 카드 포함)`,
  ];
  if (body.source?.type === "youtube") {
    parts.push(
      `## 원본 유튜브 영상\n제목: ${body.source.title}\n채널: ${body.source.author}\nURL: ${body.source.url}\n\n` +
        `## 자막 (시간 표기 포함, 발췌)\n${body.source.transcript.slice(0, 16000)}`,
    );
  }
  if (body.reference) {
    parts.push(
      `## 참고 스타일 — 이 톤과 색을 일관되게 이어갈 것\n` +
        `theme: ${JSON.stringify(body.reference.theme)}\n` +
        `이전 카피 예시:\n${body.reference.sampleTexts.slice(0, 12).join("\n")}`,
    );
  }
  if (body.accent && /^#[0-9a-fA-F]{3,8}$/.test(body.accent)) {
    parts.push(
      `## 브랜드 포인트 색 (반드시 지킬 것)\n` +
        `theme.accent = "${body.accent}" 로 고정. 이 색을 세트 전체의 포인트 색(오버라인/번호/강조/CTA/얇은 바 등)으로 일관되게 사용.\n` +
        `이 포인트 색이 잘 살도록 배경·딤을 정할 것: 포인트 색과 대비되는 어둡고 차분한 배경을 고르고, 사진 배경이면 딤을 충분히(0.4~0.65) 올려 포인트 색 요소가 또렷하게 튀도록. 배경이나 큰 텍스트를 포인트 색과 비슷하게 칠해 묻히게 하지 말 것.`,
    );
  }

  // Streams `{theme, cards}` as SSE — the client renders each card as it lands.
  return streamResponse({
    system: generateSystem(body.format, body.lang),
    content: parts.join("\n\n"),
    schema: generateSchema,
    model: body.model,
  });
}
