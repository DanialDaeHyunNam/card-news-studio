// OpenAI-compatible chat/completions adapter (OpenAI itself + Gemini via its
// compat endpoint). Isomorphic on purpose: the server dispatcher (lib/ai.ts)
// calls it with the .env.local key, the hosted BYOK path (lib/ai-client.ts)
// calls it in the browser with the user's own key. Plain fetch, no SDK.

import type { ModelInfo } from "./models";
import type { MsgContent } from "./requests";
import type { AiRequest } from "./requests";
import type { UsageEvent } from "./usage";

// Wire events streamed to the UI. `delta` streams raw JSON text; `done` carries
// the authoritative full text (for the final parse) plus usage; `error` reports
// a failure mid-stream.
export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; text: string; usage: UsageEvent }
  | { type: "error"; error: string };

type OpenAiPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function toOpenAiContent(content: MsgContent): string | OpenAiPart[] {
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

export async function* openaiCompatStream(
  model: ModelInfo,
  opts: AiRequest,
  apiKey: string,
): AsyncGenerator<StreamEvent> {
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
      authorization: `Bearer ${apiKey}`,
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
