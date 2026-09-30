import { NextResponse } from "next/server";
import { streamResponse } from "@/lib/ai";
import { buildPlanRequest, type PlanBody } from "@/lib/requests";

export const maxDuration = 300;

// Analysis step of the create harness (lib/harness.ts). Same request on every
// track — built in lib/requests.ts, dispatched by lib/ai.ts (API or CLI).
export async function POST(req: Request) {
  let body: PlanBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  try {
    return streamResponse(buildPlanRequest(body));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "잘못된 요청입니다." }, { status: 400 });
  }
}
