// Server-only: provider-dispatching AI helper for the route handlers.
// Everything streams: routes return Server-Sent Events, the client renders the
// JSON as it arrives (reply text char-by-char, cards one at a time).
//   - Anthropic → official SDK `.stream()` with structured outputs.
//   - OpenAI AND Google (Gemini) → chat/completions SSE with JSON mode. Gemini
//     rides OpenAI's wire format via its OpenAI-compatible endpoint (apiBase),
//     so one adapter serves both — only a couple of param names differ.
import Anthropic from "@anthropic-ai/sdk";
import { resolveModel, type ModelInfo } from "./models";
import type { UsageEvent } from "./usage";

export interface RequestOpts {
  system: string;
  content: Anthropic.MessageParam["content"];
  schema: Record<string, unknown>;
  model?: string;
}

// Wire events sent to the client. `delta` streams raw JSON text; `done` carries
// the authoritative full text (for the final parse) plus usage; `error` reports
// a failure mid-stream.
export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; text: string; usage: UsageEvent }
  | { type: "error"; error: string };

export async function* streamStructured(opts: RequestOpts): AsyncGenerator<StreamEvent> {
  const model = resolveModel(opts.model);
  if (!process.env[model.envVar]) {
    throw new Error(
      `${model.label} 모델을 쓰려면 ${model.envVar} 키가 필요합니다. 홈 화면의 키 관리에서 연결하세요.`,
    );
  }
  if (model.provider === "anthropic") {
    yield* anthropicStream(model, opts);
  } else {
    yield* openaiCompatStream(model, opts);
  }
}

// Wrap a structured request as a streaming Response (SSE). Route handlers call
// this after their own validation. Pre-stream and mid-stream failures both
// surface as a single `error` event so the client has one code path.
export function streamResponse(opts: RequestOpts): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: StreamEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(o)}\n\n`));
      try {
        for await (const ev of streamStructured(opts)) send(ev);
      } catch (e) {
        console.error("[stream]", e);
        send({ type: "error", error: errorMessage(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

// ---------------------------------------------------------------- anthropic

async function* anthropicStream(model: ModelInfo, opts: RequestOpts): AsyncGenerator<StreamEvent> {
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: model.id,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: opts.system,
    messages: [{ role: "user", content: opts.content }],
    output_config: { format: { type: "json_schema", schema: opts.schema } },
  });

  for await (const ev of stream) {
    if (ev.type === "content_block_delta" && ev.delta.type === "text_delta" && ev.delta.text) {
      yield { type: "delta", text: ev.delta.text };
    }
  }

  const msg = await stream.finalMessage();
  if (msg.stop_reason === "max_tokens") {
    throw new Error("응답이 너무 길어 잘렸습니다. 요청을 나눠서 시도해 주세요.");
  }
  const text = msg.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("모델이 텍스트 응답을 반환하지 않았습니다.");
  }

  const u = msg.usage;
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

  yield {
    type: "done",
    text: text.text,
    usage: { model: model.id, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costUsd },
  };
}

// ------------------------------------------------------ openai / gemini (compat)

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

interface OpenAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

async function* openaiCompatStream(model: ModelInfo, opts: RequestOpts): AsyncGenerator<StreamEvent> {
  const isGoogle = model.provider === "google";
  const body: Record<string, unknown> = {
    model: model.id,
    response_format: { type: "json_object" },
    stream: true,
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
  };
  // GPT-5.x rejects `max_tokens`; Gemini's compat layer expects it.
  if (isGoogle) body.max_tokens = 16000;
  else {
    body.max_completion_tokens = 16000;
    body.stream_options = { include_usage: true };
  }

  const res = await fetch(`${model.apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env[model.envVar]}`,
    },
    body: JSON.stringify(body),
  });

  const providerLabel = isGoogle ? "Gemini" : "OpenAI";
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => null);
    const msg = err?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 401) {
      throw new Error(`${providerLabel} API 키가 잘못되었습니다. 홈 화면의 키 관리에서 다시 등록하세요.`);
    }
    if (res.status === 429) {
      throw new Error(`${providerLabel} 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.`);
    }
    throw new Error(`${providerLabel} API 오류 (${res.status}): ${msg}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  let usage: OpenAiUsage | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let json: {
        choices?: { delta?: { content?: string } }[];
        usage?: OpenAiUsage;
        error?: { message?: string };
      };
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      if (json.error) throw new Error(`${providerLabel} API 오류: ${json.error.message ?? "알 수 없음"}`);
      const delta = json.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) {
        full += delta;
        yield { type: "delta", text: delta };
      }
      if (json.usage) usage = json.usage;
    }
  }

  if (!full) throw new Error("모델이 텍스트 응답을 반환하지 않았습니다.");

  const cached = usage?.prompt_tokens_details?.cached_tokens ?? 0;
  const inputTokens = Math.max(0, (usage?.prompt_tokens ?? 0) - cached);
  const outputTokens = usage?.completion_tokens ?? 0;
  const p = model.pricing!;
  const costUsd =
    (inputTokens * p.inPerMTok + outputTokens * p.outPerMTok + cached * (p.cachedInPerMTok ?? p.inPerMTok * 0.1)) /
    1_000_000;

  yield {
    type: "done",
    text: stripFences(full),
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
