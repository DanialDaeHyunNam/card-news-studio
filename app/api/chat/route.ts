import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { streamResponse } from "@/lib/ai";
import { chatSystem } from "@/lib/prompts";
import { chatSchema } from "@/lib/schemas";
import { FORMATS, type ChatMessage, type Format, type Project, type Theme } from "@/lib/types";

export const maxDuration = 300;

// A built-in template the user pinned as a style reference in the chat.
interface TemplateRef {
  name: string;
  theme: Partial<Theme>;
  cards: { background?: string; elements: Record<string, unknown>[] }[];
}

interface ChatBody {
  project: Project;
  selection?: { cardId?: string; elementId?: string };
  history: ChatMessage[]; // prior turns, oldest first
  message: string; // the new user request
  lang?: "ko" | "en";
  attachments?: { apiDataUrl: string; width: number; height: number; bg?: string; bgUniform?: boolean }[];
  templateRef?: TemplateRef; // optional style/layout reference
}

const IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

function parseDataUrl(dataUrl: string): { mediaType: ImageMediaType; data: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m || !(IMAGE_MEDIA_TYPES as readonly string[]).includes(m[1])) return null;
  return { mediaType: m[1] as ImageMediaType, data: m[2] };
}

// Only huge inline data URLs are stripped — short same-origin URLs (/uploads,
// /api/photo, /templates) are KEPT so the model can see which image is where and
// reuse/copy it across cards or into a background. `n` is the 1-based card number
// the user sees, so "1,2번 카드" / "3~5번" map unambiguously to the right cards.
const omitData = (s: string) =>
  s.includes("data:") ? s.replace(/data:[^)'"\s]+/g, "[image-data omitted]") : s;

function sanitizeProject(project: Project) {
  return {
    id: project.id,
    name: project.name,
    format: project.format,
    theme: project.theme,
    cards: project.cards.map((c, i) => ({
      n: i + 1,
      ...c,
      background: omitData(c.background),
      elements: c.elements.map((el) =>
        el.type === "image" && el.src.startsWith("data:") ? { ...el, src: "[image-data omitted]" } : el,
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
    // Surface the detected backdrop color so the model can "separate the subject":
    // set the card background to bg, then shrink/move the image so its edges melt in.
    const bgNote = a.bg
      ? a.bgUniform
        ? ` · 배경색 ${a.bg} (단색 배경 — 인물 분리 배치 가능)`
        : ` · 대표 배경색 ${a.bg}`
      : "";
    attachmentInfo.push(`첨부 ${i}: ${a.width}×${a.height}px → src로 "attachment:${i}" 사용${bgNote}`);
  });

  const selIdx = body.selection?.cardId
    ? body.project.cards.findIndex((c) => c.id === body.selection!.cardId)
    : -1;
  const selNum = selIdx >= 0 ? selIdx + 1 : null;
  const selection = body.selection?.elementId
    ? `${selNum}번 카드(id ${body.selection.cardId})의 요소 ${body.selection.elementId}`
    : selNum
      ? `${selNum}번 카드 (요소 미선택)`
      : "없음";

  const transcript = (body.history ?? [])
    .slice(-10)
    .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.text}`)
    .join("\n");

  // A pinned template gives the model a concrete style/layout to graft onto the
  // current cards. It is a REFERENCE — text content stays unless the user asks
  // otherwise; extra instructions ("bg photo from the attached image only") win.
  let templateBlock = "";
  if (body.templateRef?.cards?.length) {
    const ref = body.templateRef;
    templateBlock =
      `## 참조 템플릿: ${ref.name}\n` +
      `사용자가 "이 템플릿 적용" 등을 요청하면, 현재 카드의 텍스트 내용은 유지한 채 아래 템플릿의 ` +
      `테마 색·카드 배경·요소 배치와 서체 스타일을 현재 카드들에 반영하는 operations를 만드세요. ` +
      `카드 수가 다르면 현재 카드를 기준으로 매핑하고, 사용자의 추가 지시(예: 특정 배경만 첨부 이미지로 교체)를 최우선으로 따르세요.\n` +
      `theme: ${JSON.stringify(ref.theme)}\n` +
      `cards(layout): ${JSON.stringify(ref.cards).slice(0, 12000)}`;
  }

  const context = [
    `## 프로젝트 JSON\n${JSON.stringify(sanitizeProject(body.project))}`,
    `## 현재 선택\n${selection}`,
    attachmentInfo.length ? `## 첨부 이미지\n${attachmentInfo.join("\n")}` : "",
    templateBlock,
    transcript ? `## 이전 대화\n${transcript}` : "",
    `## 요청\n${body.message.trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  blocks.push({ type: "text", text: context });

  // Streams `{reply, operations}` — the reply renders char-by-char, then ops apply.
  return streamResponse({
    system: chatSystem(body.project.format, body.lang),
    content: blocks,
    schema: chatSchema,
    model: body.project.model,
  });
}
