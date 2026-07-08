import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

// Local image store (dev only, like /api/keys). Chat-attached images are written
// to public/uploads/<hash>.<ext> so the project references a short, same-origin
// URL instead of a huge data URL. That keeps them out of the ~5MB localStorage
// budget, lets html-to-image export them (same origin), and — because the URL is
// short — lets the AI SEE them in the project JSON and reuse them across cards.
const isDev = () => process.env.NODE_ENV === "development";
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: Request) {
  if (!isDev()) {
    return Response.json(
      { error: "이미지 저장은 로컬 개발 모드(bun dev)에서만 가능합니다." },
      { status: 403 },
    );
  }
  let body: { dataUrl?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const m = /^data:([^;]+);base64,(.+)$/.exec(body.dataUrl ?? "");
  if (!m || !EXT[m[1]]) {
    return Response.json({ error: "이미지 데이터가 아닙니다." }, { status: 400 });
  }

  const buf = Buffer.from(m[2], "base64");
  const name = `${createHash("sha256").update(buf).digest("hex").slice(0, 16)}.${EXT[m[1]]}`;
  const dir = join(process.cwd(), "public", "uploads");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  if (!existsSync(path)) writeFileSync(path, buf); // content-hashed → dedup
  return Response.json({ url: `/uploads/${name}` });
}
