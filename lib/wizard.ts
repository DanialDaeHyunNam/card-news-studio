// The create wizard (Home): the answers, in the order they're asked —
//   1. format reference  (a post URL first; a template or a previous project as
//                         fallback; skippable) — scraping failures fall back to
//                         screenshots of the post
//   2. goal              (unfold an existing video → subtitles/script + extra
//                         asks, OR a new card set → the story, the prompt's core)
//   3. design            (card count — auto by default, design notes, photos, brand color)
//   4. aspect ratio      (suggested from the reference)
//   5. AI                (model / Claude subscription)
// Pure data + mapping; the UI is components/CreateWizard.tsx. The state lives in
// Root (app/page.tsx) so a failed generation comes back with every answer intact.
import type { Format, GenConfig, GenPhoto } from "./types";
import type { ReferencePost } from "./reference";
import type { TemplateRef } from "./requests";

export type RefSource = "url" | "template" | "project" | "none";
export type Goal = "video" | "story";

export interface RefImage {
  id: string;
  api: string; // model-sized data URL
  thumb: string;
}

export interface WizardState {
  step: number; // 0..4
  maxStep: number; // furthest step reached — the stepper only jumps back / to reached steps
  // 1. format reference
  refSource: RefSource;
  refUrl: string;
  refPost: ReferencePost | null;
  templateId: string | null;
  projectRefId: string | null;
  // 2. goal
  goal: Goal | null;
  videoUrl: string;
  videoTitle: string;
  youtubeId: string | null;
  script: string; // subtitles / script (video)
  extra: string; // what else to reflect (video)
  story: string; // the story (new card set)
  notes: string; // analytics / extra notes (either goal)
  refImages: RefImage[]; // screenshots (insights, script)
  // 3. design
  cardCount: number; // 0 = auto
  designNotes: string;
  photos: GenPhoto[];
  // 4. ratio
  format: Format;
  formatTouched: boolean; // user picked a ratio → stop auto-suggesting
  // 5. model
  model: string;
}

export function initialWizard(): WizardState {
  return {
    step: 0,
    maxStep: 0,
    refSource: "url",
    refUrl: "",
    refPost: null,
    templateId: null,
    projectRefId: null,
    goal: null,
    videoUrl: "",
    videoTitle: "",
    youtubeId: null,
    script: "",
    extra: "",
    story: "",
    notes: "",
    refImages: [],
    cardCount: 0,
    designNotes: "",
    photos: [],
    format: "4:5",
    formatTouched: false,
    model: "",
  };
}

export const WIZARD_STEPS = 5;

// Can the user move past this step?
export function stepReady(s: WizardState, step: number): boolean {
  switch (step) {
    case 1:
      if (s.goal === "video") return !!(s.script.trim() || s.extra.trim());
      if (s.goal === "story") return !!s.story.trim();
      return false;
    case 4:
      return !!s.model;
    default:
      return true; // reference, design and ratio are all optional
  }
}

// Closest card format to an image's aspect ratio (h / w).
export function formatForAspect(hOverW: number): Format {
  if (hOverW >= 1.55) return "9:16";
  if (hOverW >= 1.12) return "4:5";
  return "1:1";
}

// Suggested ratio for a reference post: the first slide's real aspect when we
// have it, else the platform's native shape.
export async function suggestFormat(ref: ReferencePost): Promise<Format> {
  if (ref.platform === "tiktok") return "9:16";
  const first = ref.slides[0];
  if (first && typeof Image !== "undefined") {
    const aspect = await new Promise<number | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalHeight / img.naturalWidth);
      img.onerror = () => resolve(null);
      img.src = first;
    });
    if (aspect) return formatForAspect(aspect);
  }
  return "4:5";
}

export function toGenConfig(
  s: WizardState,
  extras: { accent?: string; templateRef?: TemplateRef }, // accent "none" = no point color
): GenConfig {
  const video = s.goal === "video";
  return {
    mode: s.goal ?? "story",
    topic: video ? s.extra.trim() : s.story.trim(),
    script: video ? s.script.trim() || undefined : undefined,
    videoTitle: video ? s.videoTitle || undefined : undefined,
    youtubeId: video ? s.youtubeId ?? undefined : undefined,
    designNotes: s.designNotes.trim() || undefined,
    format: s.format,
    cardCount: s.cardCount,
    model: s.model,
    accent: extras.accent === "none" ? undefined : extras.accent,
    noAccent: extras.accent === "none" || undefined,
    referencePost: s.refSource === "url" ? s.refPost ?? undefined : undefined,
    templateRef: s.refSource === "template" ? extras.templateRef : undefined,
    referenceId: s.refSource === "project" ? s.projectRefId ?? undefined : undefined,
    photos: s.photos.length ? s.photos : undefined,
    refText: s.notes.trim() || undefined,
    refImages: s.refImages.length ? s.refImages.map((r) => r.api) : undefined,
  };
}
