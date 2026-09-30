import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CLAUDE_CLI_FLAG, KEY_ENV_VARS } from "@/lib/models";
import { findClaudeCli } from "@/lib/claude-cli";
import { isDesktopRuntime, isLocalRuntime } from "@/lib/runtime";

/**
 * In-UI API key management (pattern borrowed from ZCLIP/reaction-hooks).
 *   GET  → which provider keys are present (booleans only — values never
 *          leave the server) and whether this deployment can write them.
 *   POST → local runtimes only: sets the key in the running process env (works
 *          immediately, no restart) and persists it —
 *            dev:     into .env.local
 *            desktop: handed to the Electron main process, which encrypts it
 *                     with the OS keychain (safeStorage) and passes it back as
 *                     env on the next launch. Never written in plain text.
 */

// The desktop server runs as an Electron utilityProcess; parentPort is its
// message channel to electron/main.ts.
type ParentPort = { postMessage: (msg: unknown) => void };
const parentPort = (): ParentPort | undefined =>
  (process as unknown as { parentPort?: ParentPort }).parentPort;
// Printable, no whitespace — matches every provider's key format.
const KEY_SHAPE = /^[\x21-\x7E]{8,300}$/;

export async function GET() {
  return Response.json({
    writable: isLocalRuntime(),
    keys: {
      ...Object.fromEntries(KEY_ENV_VARS.map((k) => [k, Boolean(process.env[k])])),
      // Local Claude Code CLI found → the subscription models are usable.
      [CLAUDE_CLI_FLAG]: Boolean(await findClaudeCli()),
    },
  });
}

export async function POST(req: Request) {
  if (!isLocalRuntime()) {
    return Response.json(
      { error: "키 저장은 로컬 앱(데스크톱 또는 bun dev)에서만 가능합니다. 배포 환경에서는 환경 변수로 설정하세요." },
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

  if (isDesktopRuntime()) {
    const port = parentPort();
    if (!port) return Response.json({ error: "데스크톱 앱과의 연결이 없습니다." }, { status: 500 });
    port.postMessage({ type: "key:set", envVar, value: key });
    process.env[envVar] = key;
    return Response.json({ ok: true });
  }

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
