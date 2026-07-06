import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { KEY_ENV_VARS } from "@/lib/models";

/**
 * In-UI API key management (pattern borrowed from ZCLIP/reaction-hooks).
 *   GET  → which provider keys are present (booleans only — values never
 *          leave the server) and whether this deployment can write them.
 *   POST → local dev only: writes the key into .env.local AND into the
 *          running process env, so it works immediately without a restart.
 */

const isDev = () => process.env.NODE_ENV === "development";
// Printable, no whitespace — matches every provider's key format.
const KEY_SHAPE = /^[\x21-\x7E]{8,300}$/;

export async function GET() {
  return Response.json({
    writable: isDev(),
    keys: Object.fromEntries(KEY_ENV_VARS.map((k) => [k, Boolean(process.env[k])])),
  });
}

export async function POST(req: Request) {
  if (!isDev()) {
    return Response.json(
      { error: "키 저장은 로컬 개발 모드(bun dev)에서만 가능합니다. 배포 환경에서는 환경 변수로 설정하세요." },
      { status: 400 },
    );
  }

  let envVar: unknown, value: unknown;
  try {
    ({ envVar, value } = await req.json());
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (typeof envVar !== "string" || !KEY_ENV_VARS.includes(envVar)) {
    return Response.json({ error: "알 수 없는 키 종류입니다." }, { status: 400 });
  }
  if (typeof value !== "string" || !KEY_SHAPE.test(value.trim())) {
    return Response.json({ error: "API 키 형식이 아닌 것 같아요. (공백 없이 8자 이상)" }, { status: 400 });
  }
  const key = value.trim();

  const envPath = join(process.cwd(), ".env.local");
  const current = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const line = `${envVar}=${key}`;
  const pattern = new RegExp(`^${envVar}=.*$`, "m");
  const next = pattern.test(current)
    ? current.replace(pattern, line)
    : `${current.replace(/\n?$/, "\n")}${line}\n`;
  writeFileSync(envPath, next, "utf8");
  process.env[envVar] = key; // effective immediately, no restart needed

  return Response.json({ ok: true });
}
