// Client-side helpers for consuming the SSE streams from /api/generate and
// /api/chat. The server streams a growing JSON string; these extractors read
// partial JSON so the UI can render before the object is complete:
//   - extractReply    → the `reply` string as it grows (chat)
//   - extractCards    → each fully-closed card object as it lands (generate)

export interface WireEvent {
  type: "delta" | "done" | "error";
  text?: string;
  usage?: import("./usage").UsageEvent;
  error?: string;
}

// Read a Server-Sent Events response, yielding each parsed `data:` payload.
export async function* readSSE(res: Response): AsyncGenerator<WireEvent> {
  if (!res.body) throw new Error("스트림을 열 수 없습니다.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let brk: number;
    // SSE events are separated by a blank line; each carries one `data:` line.
    while ((brk = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, brk);
      buf = buf.slice(brk + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        yield JSON.parse(line.slice(5).trim());
      } catch {
        // ignore malformed frames
      }
    }
  }
}

export function stripFences(s: string): string {
  const m = /```(?:json)?\s*([\s\S]*)/.exec(s.trim());
  const body = m ? m[1] : s;
  return body.replace(/```\s*$/, "").trim();
}

function unescape(seq: string): string {
  switch (seq) {
    case "n": return "\n";
    case "t": return "\t";
    case "r": return "\r";
    case "b": return "\b";
    case "f": return "\f";
    case '"': return '"';
    case "\\": return "\\";
    case "/": return "/";
    default: return seq;
  }
}

// Pull the (possibly incomplete) value of a top-level string field out of a
// partial JSON buffer. Returns "" until the field's opening quote appears.
export function extractStringField(raw: string, key: string): string {
  const needle = `"${key}"`;
  const k = raw.indexOf(needle);
  if (k < 0) return "";
  const open = raw.indexOf('"', k + needle.length); // opening quote of the value
  if (open < 0) return "";
  let out = "";
  for (let i = open + 1; i < raw.length; i++) {
    const c = raw[i];
    if (c === "\\") {
      const next = raw[i + 1];
      if (next === undefined) break; // dangling escape at buffer end
      if (next === "u") {
        const hex = raw.slice(i + 2, i + 6);
        if (hex.length < 4) break;
        out += String.fromCharCode(parseInt(hex, 16));
        i += 5;
      } else {
        out += unescape(next);
        i += 1;
      }
      continue;
    }
    if (c === '"') break; // closing quote — value complete
    out += c;
  }
  return out;
}

export const extractReply = (raw: string): string => extractStringField(stripFences(raw), "reply");

// Walk from `start`, collecting each top-level `{...}` object substring that has
// fully closed. String-aware so braces inside strings don't count.
function completeObjects(s: string, start: number): string[] {
  const objs: string[] = [];
  let depth = 0;
  let objStart = -1;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && objStart >= 0) {
        objs.push(s.slice(objStart, i + 1));
        objStart = -1;
      }
    } else if (c === "]" && depth === 0) {
      break; // reached the end of the array we're scanning
    }
  }
  return objs;
}

// Return the first complete top-level JSON object as a string, ignoring any
// trailing content (a stray second object, prose, etc.) that weaker models
// sometimes append after the answer. null if no complete object is present.
export function firstJsonObject(raw: string): string | null {
  const s = stripFences(raw);
  const start = s.indexOf("{");
  if (start < 0) return null;
  const [obj] = completeObjects(s, start);
  return obj ?? null;
}

// Parse the model's structured output tolerantly: take the first complete JSON
// object; fall back to a plain parse of the stripped text.
export function parseStructured<T>(raw: string): T {
  const obj = firstJsonObject(raw);
  return JSON.parse(obj ?? stripFences(raw)) as T;
}

function objectAfterKey(s: string, key: string): unknown {
  const k = s.indexOf(`"${key}"`);
  if (k < 0) return undefined;
  const brace = s.indexOf("{", k);
  if (brace < 0) return undefined;
  const [obj] = completeObjects(s, brace);
  if (!obj) return undefined;
  try {
    return JSON.parse(obj);
  } catch {
    return undefined;
  }
}

export interface PartialGenerate {
  theme?: Record<string, unknown>;
  cards: Record<string, unknown>[];
}

// Extract the theme (once closed) and every fully-formed card object so far.
export function extractCards(raw: string): PartialGenerate {
  const s = stripFences(raw);
  const theme = objectAfterKey(s, "theme") as Record<string, unknown> | undefined;
  const ck = s.indexOf('"cards"');
  const cards: Record<string, unknown>[] = [];
  if (ck >= 0) {
    const bracket = s.indexOf("[", ck);
    if (bracket >= 0) {
      for (const obj of completeObjects(s, bracket + 1)) {
        try {
          cards.push(JSON.parse(obj));
        } catch {
          // partial/garbled object — skip
        }
      }
    }
  }
  return { theme, cards };
}
