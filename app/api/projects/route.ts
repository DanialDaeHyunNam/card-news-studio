import { readdirSync, readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Filesystem project store (dev only, like /api/keys and /api/asset). Projects
// live in data/projects/<id>.json — one file each, so a corrupted file loses one
// project, not all of them, and a folder copy is a full backup. localStorage's
// ~5MB quota (and its origin/port coupling) stops applying; the client falls
// back to localStorage only where this route can't run (hosted demo / prod).
const isDev = () => process.env.NODE_ENV === "development";
const DIR = join(process.cwd(), "data", "projects");
// Deletes are soft: files move here instead of being unlinked, so an
// accidental delete (or a buggy client posting a stale list) is recoverable
// by moving the file back. Latest deletion of the same id wins.
const TRASH = join(process.cwd(), "data", "trash");

// Project ids are crypto.randomUUID(), but they arrive as client JSON — never
// let one become a path segment without this check.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function GET() {
  if (!isDev()) {
    return Response.json({ error: "로컬 개발 모드(bun dev)에서만 사용할 수 있습니다." }, { status: 403 });
  }
  if (!existsSync(DIR)) return Response.json({ projects: [] });
  const projects: unknown[] = [];
  for (const f of readdirSync(DIR)) {
    if (!f.endsWith(".json")) continue;
    try {
      const p = JSON.parse(readFileSync(join(DIR, f), "utf8"));
      if (p && typeof p.id === "string") projects.push(p);
    } catch {
      // skip unreadable files instead of failing the whole list
    }
  }
  (projects as { createdAt?: number }[]).sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  return Response.json({ projects });
}

export async function POST(req: Request) {
  if (!isDev()) {
    return Response.json({ error: "로컬 개발 모드(bun dev)에서만 사용할 수 있습니다." }, { status: 403 });
  }
  let body: { projects?: { id?: unknown }[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!Array.isArray(body.projects)) {
    return Response.json({ error: "projects 배열이 필요합니다." }, { status: 400 });
  }
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

  const keep = new Set<string>();
  for (const p of body.projects) {
    const id = typeof p?.id === "string" ? p.id : "";
    if (!SAFE_ID.test(id)) continue;
    keep.add(`${id}.json`);
    const path = join(DIR, `${id}.json`);
    const next = JSON.stringify(p, null, 2);
    // Skip untouched projects — a save rewrites only what actually changed.
    try {
      if (existsSync(path) && readFileSync(path, "utf8") === next) continue;
    } catch {
      /* unreadable → rewrite */
    }
    writeFileSync(path, next, "utf8");
  }
  // Deleting a project in the app moves its file to data/trash (soft delete).
  for (const f of readdirSync(DIR)) {
    if (f.endsWith(".json") && !keep.has(f)) {
      if (!existsSync(TRASH)) mkdirSync(TRASH, { recursive: true });
      renameSync(join(DIR, f), join(TRASH, f));
    }
  }
  return Response.json({ ok: true, count: keep.size });
}
