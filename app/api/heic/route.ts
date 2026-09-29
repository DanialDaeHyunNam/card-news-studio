import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

// iPhone photos arrive as HEIC, which Chrome/Firefox can't decode. On a local
// Mac we convert with the built-in `sips` (no dependency); elsewhere the client
// tells the user to export as JPG/PNG. Dev-only, like /api/asset.
const run = promisify(execFile);

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development" || process.platform !== "darwin") {
    return Response.json({ error: "HEIC 변환은 로컬 macOS에서만 가능합니다." }, { status: 403 });
  }
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0 || buf.length > 60 * 1024 * 1024) {
    return Response.json({ error: "잘못된 파일입니다." }, { status: 400 });
  }
  const dir = await mkdtemp(join(tmpdir(), "cardnews-heic-"));
  try {
    const src = join(dir, "in.heic");
    const out = join(dir, "out.jpg");
    await writeFile(src, buf);
    // Long edge 2160px = 2× the 1080 export width — sharp on cards, light on disk.
    await run("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "88", "-Z", "2160", src, "--out", out]);
    return new Response(new Uint8Array(await readFile(out)), { headers: { "content-type": "image/jpeg" } });
  } catch {
    return Response.json({ error: "HEIC 변환에 실패했습니다." }, { status: 500 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
