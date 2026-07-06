import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { structuredRequest, errorMessage } from "@/lib/ai";
import { chatSystem } from "@/lib/prompts";
import { chatSchema } from "@/lib/schemas";
import { FORMATS, type ChatMessage, type Format, type Project } from "@/lib/types";

export const maxDuration = 300;

interface ChatBody {
  project: Project;
  selection?: { cardId?: string; elementId?: string };
  history: ChatMessage[]; // prior turns, oldest first
  message: string; // the new user request
  lang?: "ko" | "en";
  attachments?: { apiDataUrl: string; width: number; height: number }[];
}

const IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

function parseDataUrl(dataUrl: string): { mediaType: ImageMediaType; data: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m || !(IMAGE_MEDIA_TYPES as readonly string[]).includes(m[1])) return null;
  return { mediaType: m[1] as ImageMediaType, data: m[2] };
}

// Image srcs are large data URLs the model doesn't need — strip before sending.
function sanitizeProject(project: Project) {
  return {
    id: project.id,
    name: project.name,
    format: project.format,
    theme: project.theme,
    cards: project.cards.map((c) => ({
      ...c,
      elements: c.elements.map((el) =>
        el.type === "image" ? { ...el, src: "[image-data omitted]" } : el,
      ),
    })),
  };
}

export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!body.project || !FORMATS[body.project.format as Format] || !body.message?.trim()) {
    return NextResponse.json({ error: "project와 message가 필요합니다." }, { status: 400 });
  }

  const blocks: Anthropic.ContentBlockParam[] = [];
  const attachmentInfo: string[] = [];
  (body.attachments ?? []).forEach((a, i) => {
    const parsed = parseDataUrl(a.apiDataUrl);
    if (!parsed) return;
    blocks.push({
      type: "image",
      source: { type: "base64", media_type: parsed.mediaType, data: parsed.data },
    });
    attachmentInfo.push(`첨부 ${i}: ${a.width}×${a.height}px → src로 "attachment:${i}" 사용`);
  });

  const selection = body.selection?.elementId
    ? `카드 ${body.selection.cardId}의 요소 ${body.selection.elementId}`
    : body.selection?.cardId
      ? `카드 ${body.selection.cardId} (요소 미선택)`
      : "없음";

  const transcript = (body.history ?? [])
    .slice(-10)
    .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.text}`)
    .join("\n");

  const context = [
    `## 프로젝트 JSON\n${JSON.stringify(sanitizeProject(body.project))}`,
    `## 현재 선택\n${selection}`,
    attachmentInfo.length ? `## 첨부 이미지\n${attachmentInfo.join("\n")}` : "",
    transcript ? `## 이전 대화\n${transcript}` : "",
    `## 요청\n${body.message.trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  blocks.push({ type: "text", text: context });

  try {
    const { data, usage } = await structuredRequest<{ reply: string; operations: unknown[] }>({
      system: chatSystem(body.project.format, body.lang),
      content: blocks,
      schema: chatSchema,
      model: body.project.model,
    });
    return NextResponse.json({ ...data, usage });
  } catch (e) {
    console.error("[chat]", e);
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
