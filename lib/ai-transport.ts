// The one entry point UI code uses to run an AI request. Two transports:
//   - local dev: POST the API route; the server holds the key (.env.local) and
//     streams SSE back — exactly the pre-v0.8 behavior, unchanged.
//   - hosted (BYOK): build the identical request client-side (lib/requests.ts)
//     and stream straight from the browser to the provider (lib/ai-client.ts)
//     with the user's own key. Our server never sees the request.
// Callers just `for await` WireEvents and can't tell which transport ran.

import { readSSE, type WireEvent } from "./stream";
import {
  buildChatRequest,
  buildGenerateRequest,
  buildVideoBgRequest,
  type ChatBody,
  type GenerateBody,
} from "./requests";
import { streamDirect } from "./ai-client";
import { getClientKey } from "./client-keys";
import { resolveModel } from "./models";

// Same signal lib/hooks.ts useHosted reads — usable outside React.
export function isHostedRuntime(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.hosted === "1";
}

async function* viaRoute(path: string, body: unknown): AsyncGenerator<WireEvent> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // Validation failures come back as JSON, not an event stream.
  if (!res.headers.get("content-type")?.includes("event-stream")) {
    const d = await res.json().catch(() => null);
    throw new Error(d?.error || `요청 실패 (${res.status})`);
  }
  yield* readSSE(res);
}

function requireClientKey(modelId: string | undefined): string {
  const model = resolveModel(modelId);
  const key = getClientKey(model.envVar);
  if (!key) {
    throw new Error(
      `${model.label} 모델을 쓰려면 ${model.envVar} 키가 필요합니다. 홈 화면의 키 관리에서 연결하세요.`,
    );
  }
  return key;
}

export function streamGenerate(body: GenerateBody): AsyncGenerator<WireEvent> {
  if (isHostedRuntime()) return streamDirect(buildGenerateRequest(body), requireClientKey(body.model));
  return viaRoute("/api/generate", body);
}

export function streamChat(body: ChatBody): AsyncGenerator<WireEvent> {
  if (isHostedRuntime()) return streamDirect(buildChatRequest(body), requireClientKey(body.project.model));
  return viaRoute("/api/chat", body);
}

// ------------------------------------------------------------------ video-bg

// btoa over chunks — spreading a whole image into String.fromCharCode blows the
// argument limit on big frames.
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

// Hosted path pulls the frames through the same-origin /api/frame proxy (public
// YouTube thumbnails — no key involved), then runs the vision pick directly.
async function* hostedVideoBg(videoId: string, model: string): AsyncGenerator<WireEvent> {
  const key = requireClientKey(model);
  const frames = (
    await Promise.all(
      [0, 1, 2, 3].map(async (n) => {
        try {
          const r = await fetch(`/api/frame?v=${videoId}&n=${n}`);
          if (!r.ok) return null;
          return { index: n, b64: toBase64(await r.arrayBuffer()) };
        } catch {
          return null;
        }
      }),
    )
  ).filter((f): f is { index: number; b64: string } => f !== null);
  yield* streamDirect(buildVideoBgRequest(frames, model), key);
}

export function streamVideoBg(videoId: string, model: string, lang: "ko" | "en"): AsyncGenerator<WireEvent> {
  if (isHostedRuntime()) return hostedVideoBg(videoId, model);
  return viaRoute("/api/video-bg", { videoId, model, lang });
}
