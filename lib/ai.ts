// Server-only: provider-dispatching AI helper for the route handlers.
// Everything streams: routes return Server-Sent Events, the client renders the
// JSON as it arrives (reply text char-by-char, cards one at a time).
//   - Anthropic → official SDK `.stream()` with structured outputs.
//   - OpenAI AND Google (Gemini) → the shared chat/completions adapter in
//     lib/ai-compat.ts (also used by the hosted BYOK browser path).
// Request assembly lives in lib/requests.ts so the hosted browser path builds
// byte-identical prompts.
import Anthropic from "@anthropic-ai/sdk";
import { resolveModel, type ModelInfo } from "./models";
import { openaiCompatStream, type StreamEvent } from "./ai-compat";
import type { AiRequest } from "./requests";

export type { StreamEvent };
export type RequestOpts = AiRequest;

export async function* streamStructured(opts: RequestOpts): AsyncGenerator<StreamEvent> {
  const model = resolveModel(opts.model);
  const key = process.env[model.envVar];
  if (!key) {
    throw new Error(
      `${model.label} 모델을 쓰려면 ${model.envVar} 키가 필요합니다. 홈 화면의 키 관리에서 연결하세요.`,
    );
  }
  if (model.provider === "anthropic") {
    yield* anthropicStream(model, opts);
  } else {
    yield* openaiCompatStream(model, opts, key);
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
