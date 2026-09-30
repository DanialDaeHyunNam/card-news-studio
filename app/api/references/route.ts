import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Reference library store (dev only, like /api/projects): every reference post
// the user loaded or bookmarked, in one small JSON file (slides are /uploads
// URLs, not image data). The client falls back to localStorage where this
// route can't run (hosted / prod). `data/` is gitignored.
const isDev = () => process.env.NODE_ENV === "development";
const DIR = join(process.cwd(), "data");
const FILE = join(DIR, "references.json");

export async function GET() {
  if (!isDev()) return Response.json({ error: "로컬 개발 모드에서만 사용할 수 있습니다." }, { status: 403 });
  if (!existsSync(FILE)) return Response.json({ references: [] });
  try {
    const list = JSON.parse(readFileSync(FILE, "utf8"));
    return Response.json({ references: Array.isArray(list) ? list : [] });
  } catch {
    return Response.json({ references: [] });
  }
}

export async function POST(req: Request) {
  if (!isDev()) return Response.json({ error: "로컬 개발 모드에서만 사용할 수 있습니다." }, { status: 403 });
  let body: { references?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!Array.isArray(body.references)) return Response.json({ error: "references 배열이 필요합니다." }, { status: 400 });
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  // Write-then-rename so a crash mid-write can't leave a half file.
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(body.references, null, 2), "utf8");
  renameSync(tmp, FILE);
  return Response.json({ ok: true, count: body.references.length });
}
