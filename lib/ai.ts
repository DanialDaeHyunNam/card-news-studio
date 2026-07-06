// Server-only: provider-dispatching AI helper for the route handlers.
// Anthropic goes through the official SDK with structured outputs; OpenAI goes
// through chat/completions with JSON mode (schema embedded in the system
// prompt — our client-side normalizers tolerate loose fields anyway).
import Anthropic from "@anthropic-ai/sdk";
import { resolveModel, type ModelInfo } from "./models";
import type { UsageEvent } from "./usage";

interface RequestOpts {
  system: string;
  content: Anthropic.MessageParam["content"];
  schema: Record<string, unknown>;
  model?: string;
}

export async function structuredRequest<T>(opts: RequestOpts): Promise<{ data: T; usage: UsageEvent }> {
  const model = resolveModel(opts.model);
  if (!process.env[model.envVar]) {
    throw new Error(
      `${model.label} 모델을 쓰려면 ${model.envVar} 키가 필요합니다. 홈 화면의 키 관리에서 연결하세요.`,
    );
  }
  return model.provider === "openai" ? openaiRequest<T>(model, opts) : anthropicRequest<T>(model, opts);
}

// ---------------------------------------------------------------- anthropic

async function anthropicRequest<T>(model: ModelInfo, opts: RequestOpts): Promise<{ data: T; usage: UsageEvent }> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: model.id,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: opts.system,
    messages: [{ role: "user", content: opts.content }],
    output_config: { format: { type: "json_schema", schema: opts.schema } },
  });
  if (response.stop_reason === "max_tokens") {
    throw new Error("응답이 너무 길어 잘렸습니다. 요청을 나눠서 시도해 주세요.");
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("모델이 텍스트 응답을 반환하지 않았습니다.");
  }

  const u = response.usage;
  const inputTokens = u.input_tokens ?? 0;
  const outputTokens = u.output_tokens ?? 0;
  const cacheReadTokens = u.cache_read_input_tokens ?? 0;
  const cacheCreationTokens = u.cache_creation_input_tokens ?? 0;
  const p = model.pricing!;
  const costUsd =
    (inputTokens * p.inPerMTok +
      outputTokens * p.outPerMTok +
      cacheReadTokens * p.inPerMTok * 0.1 +
      cacheCreationTokens * p.inPerMTok * 1.25) /
    1_000_000;

  return {
    data: JSON.parse(text.text) as T,
    usage: { model: model.id, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costUsd },
  };
}

// ------------------------------------------------------------------ openai

type OpenAiPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function toOpenAiContent(content: Anthropic.MessageParam["content"]): string | OpenAiPart[] {
  if (typeof content === "string") return content;
  const parts: OpenAiPart[] = [];
  for (const block of content) {
    if (typeof block === "string") continue;
    if (block.type === "text") {
      parts.push({ type: "text", text: block.text });
    } else if (block.type === "image" && block.source.type === "base64") {
      parts.push({
        type: "image_url",
        image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` },
      });
    }
  }
  return parts;
}

function stripFences(s: string): string {
  const m = /```(?:json)?\s*([\s\S]*?)```/.exec(s);
  return (m ? m[1] : s).trim();
}

async function openaiRequest<T>(model: ModelInfo, opts: RequestOpts): Promise<{ data: T; usage: UsageEvent }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env[model.envVar]}`,
    },
    body: JSON.stringify({
      model: model.id,
      max_completion_tokens: 16000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `${opts.system}\n\n## 출력 형식 (중요)\n` +
            `아래 JSON Schema에 맞는 JSON 객체 하나만 출력할 것. 다른 텍스트 금지.\n` +
            JSON.stringify(opts.schema),
        },
        { role: "user", content: toOpenAiContent(opts.content) },
      ],
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 401) {
      throw new Error("OpenAI API 키가 잘못되었습니다. 홈 화면의 키 관리에서 다시 등록하세요.");
    }
    if (res.status === 429) {
      throw new Error("OpenAI 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.");
    }
    throw new Error(`OpenAI API 오류 (${res.status}): ${msg}`);
  }

  const text = body?.choices?.[0]?.message?.content;
  if (!text) throw new Error("모델이 텍스트 응답을 반환하지 않았습니다.");

  const u = body.usage ?? {};
  const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
  const inputTokens = Math.max(0, (u.prompt_tokens ?? 0) - cached);
  const outputTokens = u.completion_tokens ?? 0;
  const p = model.pricing!;
  const costUsd =
    (inputTokens * p.inPerMTok + outputTokens * p.outPerMTok + cached * (p.cachedInPerMTok ?? p.inPerMTok * 0.1)) /
    1_000_000;

  return {
    data: JSON.parse(stripFences(text)) as T,
    usage: { model: model.id, inputTokens, outputTokens, cacheReadTokens: cached, cacheCreationTokens: 0, costUsd },
  };
}

// ------------------------------------------------------------------ errors

export function errorMessage(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) {
    return "Anthropic API 키가 없거나 잘못되었습니다. 홈 화면의 키 입력창에 붙여넣으면 바로 적용돼요.";
  }
  if (e instanceof Anthropic.RateLimitError) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (e instanceof Anthropic.APIError) {
    return `Claude API 오류 (${e.status}): ${e.message}`;
  }
  return e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
}
