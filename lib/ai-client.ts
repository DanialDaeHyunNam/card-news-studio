// Hosted BYOK dispatcher — runs the SAME structured requests as lib/ai.ts, but
// in the browser, with the USER'S key, straight to the provider. No SDK: raw
// fetch + SSE so the bundle stays light and all three providers share one
// pattern. The key travels in a request HEADER to the provider's domain and
// nowhere else — never in a URL, never to our server, never in a log. That is
// the contract the key-panel disclaimer states; if an implementation change
// would break it, change the implementation, not the copy.

import { resolveModel, type ModelInfo } from "./models";
import { openaiCompatStream, type StreamEvent } from "./ai-compat";
import type { AiRequest } from "./requests";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export async function* streamDirect(req: AiRequest, apiKey: string): AsyncGenerator<StreamEvent> {
  const model = resolveModel(req.model);
  if (model.provider === "anthropic") {
    yield* anthropicDirect(model, req, apiKey);
  } else {
    yield* openaiCompatStream(model, req, apiKey);
  }
}

// Anthropic Messages API over raw SSE. Browser calls are officially supported
// when the `anthropic-dangerous-direct-browser-access` header is set — the
// "dangerous" warns against shipping the OPERATOR'S key to clients; sending the
// user's own key from their own browser is exactly the intended use.
async function* anthropicDirect(model: ModelInfo, req: AiRequest, apiKey: string): AsyncGenerator<StreamEvent> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: model.id,
      max_tokens: 16000,
      stream: true,
      thinking: { type: "adaptive" },
      system: req.system,
      messages: [{ role: "user", content: req.content }],
      output_config: { format: { type: "json_schema", schema: req.schema } },
    }),
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => null);
    const msg = err?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 401) {
      throw new Error("Anthropic API 키가 없거나 잘못되었습니다. 홈 화면의 키 입력창에 붙여넣으면 바로 적용돼요.");
    }
    if (res.status === 429) {
      throw new Error("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
    }
    throw new Error(`Claude API 오류 (${res.status}): ${msg}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  let stopReason: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue; // event:/ping/blank lines
      let json: {
        type?: string;
        message?: {
          usage?: {
            input_tokens?: number;
            cache_read_input_tokens?: number;
            cache_creation_input_tokens?: number;
          };
        };
        delta?: { type?: string; text?: string; stop_reason?: string };
        usage?: { output_tokens?: number };
        error?: { message?: string };
      };
      try {
        json = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }
      switch (json.type) {
        case "message_start": {
          const u = json.message?.usage;
          inputTokens = u?.input_tokens ?? 0;
          cacheReadTokens = u?.cache_read_input_tokens ?? 0;
          cacheCreationTokens = u?.cache_creation_input_tokens ?? 0;
          break;
        }
        case "content_block_delta":
          if (json.delta?.type === "text_delta" && json.delta.text) {
            full += json.delta.text;
            yield { type: "delta", text: json.delta.text };
          }
          break;
        case "message_delta":
          if (json.usage?.output_tokens != null) outputTokens = json.usage.output_tokens;
          if (json.delta?.stop_reason) stopReason = json.delta.stop_reason;
          break;
        case "error":
          throw new Error(`Claude API 오류: ${json.error?.message ?? "알 수 없음"}`);
      }
    }
  }

  if (stopReason === "max_tokens") {
    throw new Error("응답이 너무 길어 잘렸습니다. 요청을 나눠서 시도해 주세요.");
  }
  if (!full) throw new Error("모델이 텍스트 응답을 반환하지 않았습니다.");

  const p = model.pricing!;
  const costUsd =
    (inputTokens * p.inPerMTok +
      outputTokens * p.outPerMTok +
      cacheReadTokens * p.inPerMTok * 0.1 +
      cacheCreationTokens * p.inPerMTok * 1.25) /
    1_000_000;

  yield {
    type: "done",
    text: full,
    usage: { model: model.id, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costUsd },
  };
}
