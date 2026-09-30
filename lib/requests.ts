// Pure request builders shared by the API routes (local mode) and the hosted
// BYOK client path (lib/ai-transport.ts). Both modes assemble the EXACT same
// system prompt / content / schema through these functions, so local and
// hosted can never drift apart. No env access, no fs — safe in the browser.
// (Anthropic types are imported type-only: erased at compile time, no SDK in
// the client bundle.)

import type Anthropic from "@anthropic-ai/sdk";
import {
  generateSystem,
  chatSystem,
  photoSetRules,
  photoPlanRules,
  planSystem,
  referenceRules,
  referenceStyleRules,
} from "./prompts";
import { generateSchema, chatSchema, planSchema } from "./schemas";
import { LAYOUT_SLOTS, type PlannedCard, type RefStyle } from "./photoset";
import { outputLangRule, sourceText, type OutputLang } from "./lang";
import { FORMATS, type ChatMessage, type Format, type Project, type Theme } from "./types";

export type MsgContent = Anthropic.MessageParam["content"];

// The provider-agnostic request both dispatchers consume (lib/ai.ts server,
// lib/ai-client.ts browser).
export interface AiRequest {
  system: string;
  content: MsgContent;
  schema: Record<string, unknown>;
  model?: string;
  // Reasoning depth, applied identically on every track: Anthropic API
  // output_config.effort, `claude -p --effort`, OpenAI reasoning_effort.
  // Pinned per step so the API matches the subscription CLI's quality.
  effort?: Effort;
}

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

// Builders throw plain Errors on invalid input; the route maps them to a 400,
// the hosted client surfaces them as the generation error.

// ------------------------------------------------------------------ generate

import type { ReferencePost } from "./reference";

// Text summary of a reference post; its slides ride along as image blocks
// labelled "레퍼런스 슬라이드 N" (see addLabeledImages).
function referenceBlock(ref: ReferencePost): string {
  const n = (v: number | undefined, label: string) => (v !== undefined ? `${label} ${v.toLocaleString("en-US")}` : "");
  const stats = [
    n(ref.stats.plays, "재생"),
    n(ref.stats.likes, "좋아요"),
    n(ref.stats.comments, "댓글"),
    n(ref.stats.shares, "공유"),
    n(ref.stats.saves, "저장"),
  ]
    .filter(Boolean)
    .join(" · ");
  const kind = {
    carousel: `캐러셀 ${ref.totalSlides}장`,
    document: `문서형 캐러셀 ${ref.totalSlides}페이지`,
    video: "영상(커버만)",
    image: "단일 이미지",
    text: "텍스트 게시물",
  }[ref.kind];
  const platform = ref.platform === "upload" ? "사용자가 올린 캡처" : ref.platform;
  const texts = ref.slideTexts?.length
    ? `\n슬라이드별 텍스트:\n${ref.slideTexts.map((t, i) => `${i + 1}. ${t.slice(0, 400)}`).join("\n")}`
    : "";
  const transcript = ref.transcript ? `\n영상 자막:\n${ref.transcript.slice(0, 4000)}` : "";
  return (
    `## 레퍼런스 게시물 (${platform}${ref.author ? ` · @${ref.author}` : ""} · ${kind}${stats ? ` · ${stats}` : ""})\n` +
    (ref.url ? `URL: ${ref.url}\n` : "") +
    `캡션/본문:\n${ref.caption.slice(0, 3000) || "(없음)"}${texts}${transcript}\n` +
    `슬라이드 이미지는 메시지의 "레퍼런스 슬라이드 N".`
  );
}

function addLabeledImages(blocks: Anthropic.ContentBlockParam[], label: string, dataUrls: string[] | undefined, max: number) {
  (dataUrls ?? [])
    .map(parseDataUrl)
    .filter((p) => p !== null)
    .slice(0, max)
    .forEach((img, i) => {
      blocks.push({ type: "text", text: `${label} ${i + 1}:` });
      blocks.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
    });
}

// The create wizard's answers. `mode` picks the framing: "video" = unfold an
// existing video (script = its subtitles/script, topic = what else to reflect),
// "story" = a fresh card set (topic = the story, the core of the prompt).
export interface GenerateBody {
  topic: string;
  format: Format;
  mode?: "video" | "story";
  script?: string; // video subtitles / script (mode "video")
  videoTitle?: string;
  designNotes?: string; // free-form design wishes — highest-priority styling input
  cardCount?: number; // 0 = auto
  photos?: string[]; // user photos (model-sized data URLs) → cycled card backgrounds
  refText?: string; // analytics / extra notes
  refImages?: string[]; // screenshots (script, insights)
  referencePost?: ReferencePost; // FORMAT reference (Instagram / LinkedIn / TikTok / screenshots)
  templateRef?: TemplateRef; // fallback format reference: a built-in template
  model?: string;
  lang?: "ko" | "en";
  accent?: string; // fixed brand point color (hex)
  noAccent?: boolean; // no point color at all
  reference?: { theme: Theme; sampleTexts: string[] }; // continue a previous project's style
  plan?: PlannedCard[]; // from the analysis step: fixed card count, layout + photo per slot
  refStyle?: RefStyle; // the reference's measured look + narrative (analysis step)
  outputLang?: OutputLang; // copy language: "auto" = follow the source content (default)
  intent?: string; // the creator's stated purpose & audience — top priority for the copy
}

function planText(plan: PlannedCard[]): string {
  return plan
    .map((c, i) => {
      const slots = LAYOUT_SLOTS[c.layout] ?? [];
      const cuts = slots
        .map((r, j) => `슬롯${j + 1}(x${r.x} y${r.y} w${r.w} h${r.h}) = ${c.photos[j] ? `사진 ${c.photos[j]}` : "사진 없음"}`)
        .join(" · ");
      return `${i + 1}장: ${c.layout}${cuts ? ` — ${cuts}` : " (텍스트만)"}${c.idea ? ` · 내용: ${c.idea}` : ""}`;
    })
    .join("\n");
}

export function buildGenerateRequest(body: GenerateBody): AiRequest {
  const photos = (body.photos ?? []).map(parseDataUrl).filter((p) => p !== null).slice(0, 20);
  const refImages = (body.refImages ?? []).map(parseDataUrl).filter((p) => p !== null).slice(0, 10);
  const ig = body.referencePost;
  const hasMaterial =
    photos.length > 0 || refImages.length > 0 || !!body.refText?.trim() || !!ig || !!body.script?.trim();
  if ((!body.topic?.trim() && !hasMaterial) || !FORMATS[body.format]) {
    throw new Error("topic과 format이 필요합니다.");
  }

  const auto = !body.cardCount && !body.plan?.length; // 0/undefined → the model decides
  const video = body.mode === "video";
  const parts = [
    video
      ? `## 목표: 이미 있는 영상을 캐러셀(카드뉴스)로 펼치기${body.videoTitle ? `\n영상 제목: ${body.videoTitle}` : ""}\n` +
        `## 그 외 반영할 내용 (사용자 요청)\n${body.topic?.trim() || "(없음 — 자막의 흐름과 핵심을 충실히 펼칠 것)"}`
      : `## 목표: 새 카드뉴스 — 원하는 스토리 (프롬프트의 핵심)\n${body.topic?.trim() || "(따로 없음 — 아래 참고 자료/사진에서 주제를 잡을 것)"}`,
    body.plan?.length
      ? `## 카드 수\n${body.plan.length}장 (사진 배치 계획으로 확정)`
      : auto
        ? `## 카드 수\n자동 — 내용에 맞게 3~10장 사이에서 결정`
        : `## 카드 수\n${Math.min(Math.max(body.cardCount ?? 6, 2), 12)}장 (훅 카드와 CTA 카드 포함)`,
  ];
  if (body.intent?.trim()) {
    parts.unshift(`## 제작자가 밝힌 의도·타깃 (최우선 — brief와 모든 카피가 이걸 따를 것)\n${body.intent.trim().slice(0, 1500)}`);
  }
  if (video && body.script?.trim()) {
    parts.push(`## 영상 자막/스크립트 (원문)\n${body.script.trim().slice(0, 16000)}`);
  }
  if (body.refText?.trim()) {
    parts.push(`## 성과 데이터·참고 메모 (사용자 제공)\n${body.refText.trim().slice(0, 8000)}`);
  }
  if (body.designNotes?.trim()) {
    parts.push(`## 디자인 요청 (최우선 반영 — 레퍼런스/템플릿과 충돌하면 이쪽을 따를 것)\n${body.designNotes.trim().slice(0, 3000)}`);
  }
  if (ig) parts.push(referenceBlock(ig));
  if (body.templateRef?.cards?.length) {
    const tpl = body.templateRef;
    parts.push(
      `## 형식 레퍼런스: 템플릿 "${tpl.name}" — 이 테마 색·배경·요소 배치·서체를 따르되 내용은 새로 쓸 것\n` +
        `theme: ${JSON.stringify(tpl.theme)}\n` +
        `cards(layout): ${JSON.stringify(tpl.cards).slice(0, 10000)}`,
    );
  }
  if (body.reference) {
    parts.push(
      `## 참고 스타일 — 이 톤과 색을 일관되게 이어갈 것\n` +
        `theme: ${JSON.stringify(body.reference.theme)}\n` +
        `이전 카피 예시:\n${body.reference.sampleTexts.slice(0, 12).join("\n")}`,
    );
  }
  if (body.noAccent) {
    parts.push(
      `## 포인트 색 없음 (반드시 지킬 것)\n` +
        `브랜드 포인트 색을 쓰지 말 것: 색 있는 오버라인·강조선·번호 배지 같은 accent 장식 없이, 글자는 흰색/검정 등 무채색으로만. theme.accent는 theme.textColor와 같은 값으로.`,
    );
  } else if (body.accent && /^#[0-9a-fA-F]{3,8}$/.test(body.accent)) {
    parts.push(
      `## 브랜드 포인트 색 (반드시 지킬 것)\n` +
        `theme.accent = "${body.accent}" 로 고정. 이 색을 세트 전체의 포인트 색(오버라인/번호/강조/CTA/얇은 바 등)으로 일관되게 사용.\n` +
        `이 포인트 색이 잘 살도록 배경·딤을 정할 것: 포인트 색과 대비되는 어둡고 차분한 배경을 고르고, 사진 배경이면 딤을 충분히(0.4~0.65) 올려 포인트 색 요소가 또렷하게 튀도록. 배경이나 큰 텍스트를 포인트 색과 비슷하게 칠해 묻히게 하지 말 것.`,
    );
  }

  const langRule = outputLangRule(
    body.outputLang,
    sourceText([body.script, body.topic, body.refText]),
    body.lang ?? "ko",
  );
  let system = generateSystem(body.format, body.lang, langRule);
  const hasStyle = !!body.refStyle;
  if (photos.length > 0) {
    system += body.plan?.length
      ? `\n\n${photoPlanRules(planText(body.plan), hasStyle)}`
      : `\n\n${photoSetRules(photos.length, auto, hasStyle)}`;
  }
  if (body.refStyle) system += `\n\n${referenceStyleRules(body.refStyle)}`;
  if (body.refText?.trim() || refImages.length > 0 || ig || video || body.templateRef) {
    system += `\n\n${referenceRules()}`;
  }

  const igSlides = (ig?.slides ?? []).map(parseDataUrl).filter((p) => p !== null).slice(0, 10);
  if (photos.length === 0 && refImages.length === 0 && igSlides.length === 0) {
    return { system, content: parts.join("\n\n"), schema: generateSchema, model: body.model, effort: "high" };
  }

  // Multimodal: each image is preceded by a label the prompt refers to.
  const blocks: Anthropic.ContentBlockParam[] = [];
  addLabeledImages(blocks, "사진", body.photos, 20);
  addLabeledImages(blocks, "참고 이미지", body.refImages, 10);
  addLabeledImages(blocks, "레퍼런스 슬라이드", ig?.slides, 10);
  blocks.push({ type: "text", text: parts.join("\n\n") });
  return { system, content: blocks, schema: generateSchema, model: body.model, effort: "high" };
}

// ---------------------------------------------------------------------- chat

// A built-in template the user pinned as a style reference in the chat.
export interface TemplateRef {
  name: string;
  theme: Partial<Theme>;
  cards: { background?: string; elements: Record<string, unknown>[] }[];
}

export interface ChatBody {
  project: Project;
  selection?: { cardId?: string; elementId?: string };
  history: ChatMessage[]; // prior turns, oldest first
  message: string; // the new user request
  lang?: "ko" | "en";
  attachments?: { apiDataUrl: string; width: number; height: number; bg?: string; bgUniform?: boolean }[];
  templateRef?: TemplateRef; // optional style/layout reference
  referencePost?: ReferencePost; // a post linked in the message → restyle after it
  mentions?: ChatMention[]; // @카드N / @사진N tokens the user tagged
}

// A resolved @-mention. Image mentions ride in `attachments` (so the model sees
// them and can place them via attachment:N); `attachmentIndex` links the two.
export type ChatMention =
  | { token: string; kind: "card"; n: number; cardId: string }
  | { token: string; kind: "image"; src: string; attachmentIndex: number; usedIn: number[] };

function mentionBlock(mentions: ChatMention[]): string {
  const lines = mentions.map((m) =>
    m.kind === "card"
      ? `${m.token} = ${m.n}번 카드 (cardId ${m.cardId})`
      : `${m.token} = 첨부 ${m.attachmentIndex} 이미지` +
        (m.usedIn.length ? ` · 현재 ${m.usedIn.join(", ")}번 카드에 사용 중` : " · 업로드만 됨(카드에 아직 없음)") +
        ` → 넣을 땐 src "attachment:${m.attachmentIndex}"`,
  );
  return `## @멘션 (사용자가 태그한 대상)\n${lines.join("\n")}`;
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
    brief: project.brief, // creator intent — every edit is interpreted in its light
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

export function buildChatRequest(body: ChatBody): AiRequest {
  if (!body.project || !FORMATS[body.project.format as Format] || !body.message?.trim()) {
    throw new Error("project와 message가 필요합니다.");
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

  // Reference slides come AFTER the attachments so "첨부 N" indices (which map
  // to insertable images) stay unchanged; slides are look-only.
  if (body.referencePost) addLabeledImages(blocks, "레퍼런스 슬라이드", body.referencePost.slides, 10);

  const context = [
    `## 프로젝트 JSON\n${JSON.stringify(sanitizeProject(body.project))}`,
    `## 현재 선택\n${selection}`,
    attachmentInfo.length ? `## 첨부 이미지\n${attachmentInfo.join("\n")}` : "",
    templateBlock,
    body.referencePost ? referenceBlock(body.referencePost) : "",
    body.mentions?.length ? mentionBlock(body.mentions) : "",
    transcript ? `## 이전 대화\n${transcript}` : "",
    `## 요청\n${body.message.trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  blocks.push({ type: "text", text: context });

  return {
    system: chatSystem(body.project.format, body.lang),
    content: blocks,
    schema: chatSchema,
    model: body.project.model,
    effort: "medium", // targeted edits — snappy, same level on every track
  };
}

// ------------------------------------------------------------------ video-bg

// Picks the best video frame for a card background (see /api/video-bg). The
// frames arrive as base64 JPEGs; the caller fetched them (server: straight
// from i.ytimg.com, hosted client: via the same-origin /api/frame proxy).
export const videoBgSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    frame: { type: "integer", minimum: -1, maximum: 3, description: "best background frame index, or -1 if none" },
    accent: { type: "string", description: "hex point color matching the frame mood, e.g. #7dd3fc" },
    reason: { type: "string" },
  },
  required: ["frame", "accent"],
} as const;

export function buildVideoBgRequest(frames: { index: number; b64: string }[], model?: string): AiRequest {
  if (frames.length === 0) throw new Error("영상 프레임을 가져오지 못했습니다.");

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
  for (const f of frames) {
    content.push({ type: "text", text: `프레임 ${f.index}:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.b64 } });
  }

  return {
    system:
      "당신은 카드뉴스 배경 큐레이터입니다. 주어진 프레임 중 배경으로 가장 좋은 하나를 고르고, " +
      "어울리는 포인트 색을 정합니다. 반드시 스키마에 맞는 JSON 하나만 출력하세요.",
    content,
    schema: videoBgSchema as unknown as Record<string, unknown>,
    model,
    effort: "low",
  };
}

// ---------------------------------------------------------------------- plan

// The analysis step (see lib/harness.ts). Images go FIRST (user photos, then
// reference slides) and stay byte-identical across re-plans, so the Anthropic
// cache breakpoint after them (lib/ai-anthropic.ts) — and OpenAI's automatic
// prefix cache — make each follow-up question cheap. The Q&A goes last.
export interface PlanBody {
  format: Format;
  mode?: "video" | "story";
  topic: string;
  script?: string;
  designNotes?: string;
  cardCount?: number; // 0 = auto
  photos?: string[]; // model-sized data URLs, labelled 사진 N
  referencePost?: ReferencePost;
  dialogue?: { question: string; answer: string }[]; // earlier ask → answer turns
  outputLang?: OutputLang;
  intent?: string;
  lang?: "ko" | "en";
  model?: string;
}

export function buildPlanRequest(body: PlanBody): AiRequest {
  if (!FORMATS[body.format]) throw new Error("format이 필요합니다.");
  const blocks: Anthropic.ContentBlockParam[] = [];
  addLabeledImages(blocks, "사진", body.photos, 20);
  addLabeledImages(blocks, "레퍼런스 슬라이드", body.referencePost?.slides, 10);
  const n = (body.photos ?? []).length;
  const parts = [
    `## 카드 비율\n${body.format}`,
    `## 카드 수\n${body.cardCount ? `${body.cardCount}장 고정` : "자동 (3~10장)"}`,
    `## 사용자 사진\n${n ? `${n}장 (메시지의 "사진 1…${n}")` : "없음"}`,
    body.referencePost ? referenceBlock(body.referencePost) : "## 레퍼런스\n없음",
    body.mode === "video"
      ? `## 목표: 영상을 캐러셀로\n${body.topic || ""}\n\n## 자막/스크립트(발췌)\n${(body.script ?? "").slice(0, 6000)}`
      : `## 목표: 새 카드뉴스 — 스토리\n${body.topic}`,
    body.designNotes?.trim() ? `## 디자인 요청\n${body.designNotes.trim()}` : "",
    body.intent?.trim() ? `## 제작자가 밝힌 의도·타깃 (최우선)\n${body.intent.trim().slice(0, 1500)}` : "",
    outputLangRule(body.outputLang, sourceText([body.script, body.topic]), body.lang ?? "ko"),
    body.dialogue?.length
      ? `## 지금까지의 확인 질문과 사용자 답변 (반드시 반영)\n${body.dialogue.map((d, i) => `Q${i + 1}: ${d.question}\nA${i + 1}: ${d.answer}`).join("\n")}`
      : "",
  ].filter(Boolean);
  blocks.push({ type: "text", text: parts.join("\n\n") });
  return { system: planSystem(body.lang), content: blocks, schema: planSchema, model: body.model, effort: "high" };
}
