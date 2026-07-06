import { NextResponse } from "next/server";
import { structuredRequest, errorMessage } from "@/lib/ai";
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

  try {
    const { data, usage } = await structuredRequest<{ theme: unknown; cards: unknown[] }>({
      system: generateSystem(body.format, body.lang),
      content: parts.join("\n\n"),
      schema: generateSchema,
      model: body.model,
    });
    return NextResponse.json({ ...data, usage });
  } catch (e) {
    console.error("[generate]", e);
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
