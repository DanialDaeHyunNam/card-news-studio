import { NextResponse } from "next/server";

export const maxDuration = 60;

// Caption transcript without an API key. The public timedtext URLs from the
// watch page now require a proof-of-origin token (empty body without it), so
// we go through the InnerTube player API with the ANDROID client, whose
// caption URLs still resolve. Verified 2026-07: WEB client returns no tracks.
const YT_ID = /(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/;
const ANDROID_UA = "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip";

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string; // "asr" = auto-generated
}

function pickTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  const byLang = (lang: string) => {
    const candidates = tracks.filter((t) => t.languageCode?.startsWith(lang));
    return candidates.find((t) => t.kind !== "asr") ?? candidates[0];
  };
  return byLang("ko") ?? byLang("en") ?? tracks[0] ?? null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// The caption endpoint answers in either json3 or timedtext XML.
function parseCaptions(body: string): { t: number; text: string }[] {
  const lines: { t: number; text: string }[] = [];
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) {
    const json = JSON.parse(trimmed);
    for (const ev of json.events ?? []) {
      if (!ev.segs) continue;
      const text = ev.segs
        .map((s: { utf8?: string }) => s.utf8 ?? "")
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (text) lines.push({ t: Math.round((ev.tStartMs ?? 0) / 1000), text });
    }
  } else {
    for (const m of trimmed.matchAll(/<p t="(\d+)"[^>]*>(.*?)<\/p>/gs)) {
      const text = decodeEntities(m[2].replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
      if (text) lines.push({ t: Math.round(Number(m[1]) / 1000), text });
    }
  }
  return lines;
}

export async function POST(req: Request) {
  let url = "";
  try {
    url = String((await req.json()).url ?? "");
  } catch {
    /* fall through to validation */
  }
  const id = YT_ID.exec(url)?.[1];
  if (!id) {
    return NextResponse.json({ error: "유효한 YouTube 링크가 아닙니다." }, { status: 400 });
  }

  try {
    const player = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": ANDROID_UA },
      body: JSON.stringify({
        videoId: id,
        context: {
          client: { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 30, hl: "ko" },
        },
      }),
    }).then((r) => r.json());

    if (player?.playabilityStatus?.status && player.playabilityStatus.status !== "OK") {
      return NextResponse.json(
        { error: `영상에 접근할 수 없습니다 (${player.playabilityStatus.reason ?? player.playabilityStatus.status}).` },
        { status: 422 },
      );
    }

    const tracks: CaptionTrack[] =
      player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    const track = pickTrack(tracks);
    if (!track?.baseUrl) {
      return NextResponse.json(
        { error: "이 영상에서 자막을 찾을 수 없습니다. (자막이 없는 영상일 수 있어요)" },
        { status: 422 },
      );
    }

    const capBody = await fetch(`${track.baseUrl}&fmt=json3`, {
      headers: { "user-agent": ANDROID_UA },
    }).then((r) => r.text());
    const lines = parseCaptions(capBody);
    if (lines.length === 0) {
      return NextResponse.json({ error: "자막 내용이 비어 있습니다." }, { status: 422 });
    }

    return NextResponse.json({
      videoId: id,
      title: player?.videoDetails?.title ?? "",
      author: player?.videoDetails?.author ?? "",
      language: track.languageCode,
      auto: track.kind === "asr",
      lines,
    });
  } catch (e) {
    console.error("[youtube]", e);
    return NextResponse.json(
      { error: "YouTube에서 자막을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}
