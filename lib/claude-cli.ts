// Server-only: run a structured request through the user's locally installed
// Claude Code CLI (`claude -p`), so a local copy can generate on the user's own
// Claude subscription instead of an API key. Local dev only — never offered on
// a hosted deploy (the CLI and its login live on the user's machine).
//
// Verified with Claude Code 2.1.284 (2026-09):
//   - `--input-format stream-json` takes one SDK user message on stdin, so the
//     same content blocks (text + base64 images) as the API path go in as-is.
//   - `--json-schema` → the model answers through a `StructuredOutput` tool; its
//     `input_json_delta` stream is the growing JSON the UI's extractCards reads,
//     and the final `result` event carries `structured_output`.
//   - `--bare` is NOT usable: it disables OAuth/keychain (API-key auth only).
//     Isolation comes from the individual flags + a neutral cwd instead.
import { spawn, execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ModelInfo } from "./models";
import type { AiRequest } from "./requests";
import type { StreamEvent } from "./ai-compat";

const run = promisify(execFile);
const TIMEOUT_MS = 290_000; // under the routes' maxDuration (300s)

// A GUI-launched dev server may not have the shell's PATH, so check the usual
// install locations before falling back to PATH. CLAUDE_CLI_PATH overrides.
function candidates(): string[] {
  const home = homedir();
  return [
    process.env.CLAUDE_CLI_PATH ?? "",
    join(home, ".local/bin/claude"),
    join(home, ".claude/local/claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    "claude",
  ].filter(Boolean);
}

let cached: { bin: string | null; at: number } | null = null;

// The first candidate that answers `--version`, cached for a minute.
export async function findClaudeCli(): Promise<string | null> {
  if (process.env.NODE_ENV !== "development") return null;
  if (cached && Date.now() - cached.at < 60_000) return cached.bin;
  let bin: string | null = null;
  for (const c of candidates()) {
    if (c.includes("/") && !existsSync(c)) continue;
    try {
      await run(c, ["--version"], { timeout: 5000 });
      bin = c;
      break;
    } catch {
      /* next candidate */
    }
  }
  cached = { bin, at: Date.now() };
  return bin;
}

// A neutral cwd so the project's CLAUDE.md / .claude settings aren't picked up.
function workDir(): string {
  const dir = join(tmpdir(), "card-news-claude-cli");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

interface CliResult {
  type: string;
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export async function* claudeCliStream(model: ModelInfo, opts: AiRequest): AsyncGenerator<StreamEvent> {
  const bin = await findClaudeCli();
  if (!bin) {
    throw new Error(
      "Claude Code(claude CLI)를 찾지 못했습니다. 설치 후 터미널에서 `claude`로 로그인하세요 (경로가 특이하면 CLAUDE_CLI_PATH).",
    );
  }
  const alias = model.id.split(":")[1] ?? "opus";
  const system =
    `${opts.system}\n\n## 응답 방식 (중요)\n` +
    `설명·요약 같은 일반 텍스트는 쓰지 말고, 곧바로 StructuredOutput 도구를 한 번 호출해 결과 JSON을 제출할 것.`;

  // Strip API keys: with ANTHROPIC_API_KEY present the CLI would bill the API
  // instead of the subscription — the whole point of this path.
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;

  const child = spawn(
    bin,
    [
      "-p",
      "--input-format", "stream-json",
      "--output-format", "stream-json",
      "--verbose",
      "--include-partial-messages",
      "--model", alias,
      "--system-prompt", system,
      "--json-schema", JSON.stringify(opts.schema),
      "--tools", "",
      "--setting-sources", "",
      "--strict-mcp-config",
      "--disable-slash-commands",
      "--no-chrome",
      "--no-session-persistence",
    ],
    { cwd: workDir(), env, stdio: ["pipe", "pipe", "pipe"] },
  );
  const timer = setTimeout(() => child.kill("SIGTERM"), TIMEOUT_MS);
  let stderr = "";
  child.stderr.on("data", (d) => (stderr += String(d)).length > 4000 && (stderr = stderr.slice(-4000)));
  const exited = new Promise<number | null>((resolve) => child.on("close", resolve));
  child.on("error", () => {}); // surfaced via the exit path below

  child.stdin.end(JSON.stringify({ type: "user", message: { role: "user", content: opts.content } }) + "\n");

  let buf = "";
  let json = ""; // StructuredOutput tool input, as streamed
  let inTool = false;
  let result: CliResult | null = null;
  try {
    for await (const chunk of child.stdout) {
      buf += String(chunk);
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let ev: Partial<CliResult> & { event?: Record<string, unknown> };
        try {
          ev = JSON.parse(line);
        } catch {
          continue;
        }
        if (ev.type === "stream_event" && ev.event) {
          const e = ev.event as {
            type: string;
            content_block?: { type: string; name?: string };
            delta?: { type: string; partial_json?: string };
          };
          if (e.type === "content_block_start") {
            inTool = e.content_block?.type === "tool_use" && e.content_block.name === "StructuredOutput";
            if (inTool) json = "";
          } else if (e.type === "content_block_delta" && inTool && e.delta?.type === "input_json_delta") {
            const piece = e.delta.partial_json ?? "";
            json += piece;
            if (piece) yield { type: "delta", text: piece };
          } else if (e.type === "content_block_stop") {
            inTool = false;
          }
        } else if (ev.type === "result") {
          result = ev as CliResult;
        }
      }
    }
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null) child.kill("SIGTERM");
  }
  const code = await exited;

  if (!result) {
    const hint = /login|log in|auth|credential/i.test(stderr) ? " 터미널에서 `claude`를 실행해 로그인하세요." : "";
    throw new Error(`Claude CLI가 결과 없이 종료됐습니다 (코드 ${code}).${hint} ${stderr.trim().slice(0, 300)}`.trim());
  }
  if (result.is_error || result.structured_output === undefined) {
    throw new Error(`Claude CLI 오류: ${(result.result ?? stderr).slice(0, 400) || "구조화된 결과가 없습니다."}`);
  }

  const u = result.usage ?? {};
  yield {
    type: "done",
    text: JSON.stringify(result.structured_output) || json,
    usage: {
      model: model.id,
      inputTokens: u.input_tokens ?? 0,
      outputTokens: u.output_tokens ?? 0,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
      cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
      costUsd: 0, // billed to the subscription, not per token
    },
  };
}
