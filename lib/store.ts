import type { Project } from "./types";

// Project persistence. On local dev the store is the FILESYSTEM
// (data/projects/*.json via /api/projects) — no ~5MB localStorage quota, no
// origin/port coupling, survives clearing browser data, and a folder copy is a
// full backup. Where the dev-only route can't run (hosted demo, prod build)
// we fall back to localStorage exactly as before. The mode is decided once per
// page load by whether GET /api/projects answers.

const KEY = "cardnews.projects.v1";
// Set once the filesystem store has taken over, so deleting every project
// later doesn't resurrect the old localStorage copy on the next load.
const MIGRATED_KEY = "cardnews.migrated.v1";

let mode: "fs" | "local" = "local";

function readLocal(): Project[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Project[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(projects: Project[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(projects));
  } catch (e) {
    // localStorage quota (~5MB) can overflow when projects hold large images.
    console.error("Failed to persist projects (storage quota?)", e);
    alert("저장 공간이 가득 찼습니다. 사용하지 않는 프로젝트나 큰 이미지를 정리해 주세요.");
  }
}

export async function loadProjects(): Promise<Project[]> {
  if (typeof window === "undefined") return [];
  try {
    const res = await fetch("/api/projects");
    if (res.ok) {
      const d = await res.json();
      if (Array.isArray(d.projects)) {
        mode = "fs";
        let projects = d.projects as Project[];
        // One-time migration: adopt whatever localStorage accumulated before
        // the filesystem store existed. The copy is left in place (harmless),
        // but the marker stops it from coming back after the user deletes
        // projects in fs mode.
        if (projects.length === 0 && !window.localStorage.getItem(MIGRATED_KEY)) {
          const legacy = readLocal();
          if (legacy.length > 0) {
            projects = legacy;
            void push(projects);
          }
        }
        try {
          window.localStorage.setItem(MIGRATED_KEY, "1");
        } catch {
          /* marker is best-effort */
        }
        return projects;
      }
    }
  } catch {
    /* no dev server route (hosted/prod) → localStorage */
  }
  mode = "local";
  return readLocal();
}

// Debounced filesystem writes: mutate() fires on every gesture, and rewriting
// data/projects on each one is pointless — trailing-edge coalesce instead.
let pending: Project[] | null = null;
let timer: number | null = null;

async function push(projects: Project[]) {
  try {
    const body = JSON.stringify({ projects });
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: body.length < 60_000, // survives tab close only when small
    });
  } catch (e) {
    console.error("Failed to persist projects to disk", e);
  }
}

function flush() {
  timer = null;
  const p = pending;
  pending = null;
  if (p) void push(p);
}

export function saveProjects(projects: Project[]) {
  if (typeof window === "undefined") return;
  if (mode === "local") {
    writeLocal(projects);
    return;
  }
  pending = projects;
  if (timer === null) timer = window.setTimeout(flush, 300);
}

if (typeof window !== "undefined") {
  // Flush the debounce window when the tab hides/closes so the last gesture
  // isn't lost. keepalive above lets the request outlive the page when small.
  window.addEventListener("pagehide", () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      flush();
    }
  });
}
