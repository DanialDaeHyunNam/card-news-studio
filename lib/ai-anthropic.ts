// Isomorphic Anthropic request shape — the ONE place the Messages API body is
// assembled, shared by the server SDK path (lib/ai.ts) and the hosted BYOK
// browser path (lib/ai-client.ts). The subscription CLI path (lib/claude-cli.ts)
// maps the same AiRequest onto `claude -p` flags. Parity rules (the API path
// must behave as well as the subscription path):
//   - same model generation as the CLI aliases (lib/models.ts)
//   - same effort: AiRequest.effort → output_config.effort here, --effort there
//     (Opus 5.5's API default is `medium`, the CLI runs higher — pin it)
//   - adaptive thinking on (always-on for Opus 5.5 / Fable anyway)
// API-native strengths used here: a cache breakpoint after the image prefix
// (re-plans and generation retries reuse the photos/slides for ~0.1× input),
// and server-side refusal fallbacks on the 5.x models.
import type Anthropic from "@anthropic-ai/sdk";
import type { ModelInfo } from "./models";
import type { AiRequest, MsgContent } from "./requests";
import type { UsageEvent } from "./usage";

export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

// Mark the last image block as a cache breakpoint: everything before it (the
// images, which dominate the prompt) becomes a reusable prefix. Text after it
// (the per-request instructions / Q&A) stays uncached.
function withImageCacheBreakpoint(content: MsgContent): MsgContent {
  if (typeof content === "string") return content;
  let last = -1;
  content.forEach((b, i) => {
    if (typeof b !== "string" && b.type === "image") last = i;
  });
  if (last < 0) return content;
  return content.map((b, i) =>
    i === last && typeof b !== "string" ? ({ ...b, cache_control: { type: "ephemeral" } } as typeof b) : b,
  );
}

export interface AnthropicCall {
  body: Record<string, unknown>; // JSON body (minus `stream`)
  betas: string[];
}

export function anthropicCall(model: ModelInfo, req: AiRequest): AnthropicCall {
  const betas: string[] = [];
  const body: Record<string, unknown> = {
    model: model.id,
    // Streaming, so a large ceiling is safe; adaptive thinking + a 10-card JSON
    // set can exceed 16k on the 5.x models at high effort.
    max_tokens: model.maxOutput ?? 16000,
    system: req.system,
    messages: [{ role: "user", content: withImageCacheBreakpoint(req.content) }],
    output_config: {
      format: { type: "json_schema", schema: req.schema },
      ...(model.effort && req.effort ? { effort: req.effort } : {}),
    },
  };
  // Haiku 4.5 predates adaptive thinking (it would need budget_tokens) — leave it off there.
  if (model.effort) body.thinking = { type: "adaptive" };
  if (model.fallbacks) {
    body.fallbacks = "default"; // refusal → the API re-runs on a suitable model inside the same call
    betas.push(FALLBACK_BETA);
  }
  return { body, betas };
}

export function anthropicCost(
  model: ModelInfo,
  u: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number },
): number {
  const p = model.pricing!;
  return (
    (u.inputTokens * p.inPerMTok +
      u.outputTokens * p.outPerMTok +
      u.cacheReadTokens * (p.cachedInPerMTok ?? p.inPerMTok * 0.1) +
      u.cacheCreationTokens * p.inPerMTok * 1.25) /
    1_000_000
  );
}

export function refusalError(): Error {
  return new Error("모델이 이 요청을 안전 정책으로 거절했습니다. 표현을 바꾸거나 다른 모델로 다시 시도해 주세요.");
}

export type { UsageEvent };
export type AnthropicContent = Anthropic.MessageParam["content"];
