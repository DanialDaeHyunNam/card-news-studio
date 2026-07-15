import { NextResponse } from "next/server";
import { streamResponse } from "@/lib/ai";
import { buildChatRequest, type ChatBody } from "@/lib/requests";

export const maxDuration = 300;

// Request assembly lives in lib/requests.ts, shared verbatim with the hosted
// BYOK browser path — change prompts there, not here.
export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    // Streams `{reply, operations}` — the reply renders char-by-char, then ops apply.
    return streamResponse(buildChatRequest(body));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "잘못된 요청입니다." }, { status: 400 });
  }
}
