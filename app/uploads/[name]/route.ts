import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isLocalRuntime, uploadsDir } from "@/lib/runtime";

// Serves uploaded images at /uploads/<hash>.<ext> from uploadsDir(). In dev
// Next serves public/uploads itself before reaching this route; the desktop
// app's production server needs it (files added to public/ after the build are
// not served), and there the folder lives in the app's userData.
const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};
// Content-hashed names written by /api/asset — nothing else is ever served.
const SAFE_NAME = /^[A-Za-z0-9_-]{1,80}\.(jpe?g|png|webp|gif)$/i;

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!isLocalRuntime() || !SAFE_NAME.test(name)) return new Response("Not found", { status: 404 });
  try {
    const buf = await readFile(join(uploadsDir(), name));
    const ext = name.split(".").pop()!.toLowerCase();
    return new Response(new Uint8Array(buf), {
      headers: { "content-type": TYPES[ext], "cache-control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
