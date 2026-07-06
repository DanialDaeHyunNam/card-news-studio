import type { Project } from "./types";

const KEY = "cardnews.projects.v1";

export function loadProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Project[]) : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(projects));
  } catch (e) {
    // localStorage quota (~5MB) can overflow when projects hold large images.
    console.error("Failed to persist projects (storage quota?)", e);
    alert("저장 공간이 가득 찼습니다. 사용하지 않는 프로젝트나 큰 이미지를 정리해 주세요.");
  }
}
