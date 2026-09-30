// Shared data model. Coordinate system: x/y/w/h are PERCENT of the card
// (0–100, y from the top). fontSize/radius are px at export scale, i.e. on a
// 1080px-wide canvas — the editor multiplies by (displayWidth / 1080).

export type Format = "1:1" | "4:5" | "9:16";

export const EXPORT_WIDTH = 1080;

export const FORMATS: Record<Format, { w: number; h: number; label: string; hint: string }> = {
  "1:1": { w: 1080, h: 1080, label: "1:1", hint: "정사각형 · 인스타 피드" },
  "4:5": { w: 1080, h: 1350, label: "4:5", hint: "세로 · 피드 점유율 최대" },
  "9:16": { w: 1080, h: 1920, label: "9:16", hint: "풀스크린 · 스토리/릴스" },
};

// Text roles — a soft, extensible convention. These four are the default set;
// the AI or user can introduce more (role is a free string). Same-role text
// across cards shares one style (project.styles[role]) so it stays consistent.
export const DEFAULT_ROLES = ["overline", "mega", "title", "body", "caption"] as const;

// The shared typography for a role. A text element's own value overrides it.
export interface RoleStyle {
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  fontFamily?: string;
  lineHeight?: number;
  letterSpacing?: number;
  align?: "left" | "center" | "right";
  italic?: boolean;
  underline?: boolean;
  shadow?: boolean;
}
// The style fields a role governs — used to sync/compare element vs. shared.
export const ROLE_STYLE_KEYS = [
  "fontSize",
  "fontWeight",
  "color",
  "fontFamily",
  "lineHeight",
  "letterSpacing",
  "align",
  "italic",
  "underline",
  "shadow",
] as const;

export interface TextElement {
  id: string;
  type: "text";
  role?: string; // e.g. "overline" | "title" | "body" | "caption" (or custom)
  x: number;
  y: number;
  w: number;
  text: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  fontFamily?: string; // overrides theme.fontFamily (e.g. serif for story cards)
  letterSpacing?: number; // em units; e.g. -0.03 tight headline, 0.1 spaced overline
  italic?: boolean;
  underline?: boolean;
  shadow?: boolean; // soft drop shadow — keeps white text legible on photos
  opacity?: number; // 0–1 element alpha (default 1)
}

export interface ShapeElement {
  id: string;
  type: "shape";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  radius: number;
  opacity?: number; // 0–1 element alpha (default 1) — handy for translucent scrims
}

export interface ImageElement {
  id: string;
  type: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  src: string; // data URL
  fit: "cover" | "contain";
  radius: number;
  dim?: number; // 0–1 black overlay opacity over the image (scrim for text readability)
  opacity?: number; // 0–1 element alpha (default 1)
  // Framing inside the element (cover fit): which part of the photo shows.
  // focusX/Y = CSS object-position % (default 50/50); zoom = 1–3 scale about
  // that point. Dragging a photo on the canvas pans these, not x/y.
  focusX?: number;
  focusY?: number;
  zoom?: number;
}

export type CardElement = TextElement | ShapeElement | ImageElement;

export interface Card {
  id: string;
  background: string; // CSS color or gradient
  elements: CardElement[];
}

export interface CreatorBrief {
  intent?: string; // the creator's own words (wizard / chat)
  audience: string;
  purpose: string;
  contentType: string;
  keepOriginal: string[];
  languageNote: string; // e.g. "explanations in English, the Korean expressions stay in Hangul"
}

export interface Theme {
  background: string;
  textColor: string;
  accent: string;
  fontFamily: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  images?: string[]; // small thumbnails for display only
  ops?: number; // operations applied (assistant turns) — drives the "done" marker
  opsSummary?: string; // short English lines of what changed (shown on click)
}

export interface Project {
  id: string;
  name: string;
  format: Format;
  theme: Theme;
  cards: Card[];
  chat: ChatMessage[];
  styles?: Record<string, RoleStyle>; // shared typography per text role
  model?: string; // lib/models.ts id; undefined = default
  ignoreBrand?: boolean; // this set uses a custom accent instead of the brand color
  usage?: import("./usage").UsageTotals; // cumulative AI spend for this project
  // The format reference this set was made from — kept so the editor can show
  // it side by side (Editor "Reference" compare). Slides are small copies
  // (/uploads URLs locally, ≤480px data URLs when hosted).
  reference?: { platform: string; url: string; author: string; caption: string; slides: string[] };
  // What the creator is making, for whom — decided at generation (from the
  // wizard's intent field + the model's read of the content) and kept so every
  // later chat edit writes copy in that context. `keepOriginal` = terms that must
  // never be translated/replaced (e.g. the Korean words an English lesson teaches).
  brief?: CreatorBrief;
  createdAt: number;
  updatedAt: number;
}

// One edit instruction returned by the AI chat. Applied client-side in lib/ops.ts.
// For add_element images, src may be "attachment:N" referring to the Nth image
// attached to the chat message — the client substitutes the real data URL.
export interface Operation {
  op:
    | "update_element"
    | "add_element"
    | "remove_element"
    | "reorder_element"
    | "update_card"
    | "add_card"
    | "remove_card"
    | "update_theme"
    | "update_style" // change a role's shared typography → propagates to all same-role text
    | "update_brief"; // record/refine the creator brief (intent, audience, terms to keep as-is)
  cardId?: string;
  elementId?: string;
  index?: number;
  role?: string; // for update_style: which role's shared style to change
  patch?: Record<string, unknown>;
  brief?: Partial<CreatorBrief>; // for update_brief
  element?: Record<string, unknown>;
  card?: { background?: string; elements?: Record<string, unknown>[] };
}

// Generation request from Home → Root, and the live progress Root feeds the Editor.
export interface GenConfig {
  topic: string; // story (mode "story") or what else to reflect (mode "video")
  format: Format;
  mode?: "video" | "story";
  script?: string; // video subtitles / script
  videoTitle?: string;
  youtubeId?: string; // lets generation vision-pick a video frame as the hook background
  designNotes?: string;
  cardCount: number; // 0 = auto (the AI decides how many cards)
  model: string;
  referenceId?: string; // continue a previous project's style
  referencePost?: import("./reference").ReferencePost; // format reference (IG / LinkedIn / TikTok / screenshots)
  templateRef?: import("./requests").TemplateRef; // fallback format reference
  accent?: string; // fixed brand point color (hex); omitted = AI chooses
  noAccent?: boolean; // "None" brand mode: no point color at all (monochrome)
  photos?: GenPhoto[]; // user photos → full-bleed card backgrounds, cycled
  refText?: string; // analytics / extra notes
  refImages?: string[]; // screenshots (script, insights) — model-sized data URLs
  plan?: import("./photoset").PlannedCard[]; // analysis-step result: fixed cards + photo per slot
  refStyle?: import("./photoset").RefStyle; // the reference's measured look + narrative
  outputLang?: import("./lang").OutputLang; // copy language ("auto" = follow the source content)
  intent?: string; // creator's stated purpose & audience (wizard step 2)
  planUsage?: import("./usage").UsageEvent[]; // analysis passes — counted into the project's spend
}
// A user photo for a photo-set generation. `full` is what lands on the card
// (uploaded to /uploads on local), `api` the small copy the model looks at.
export interface GenPhoto {
  id: string;
  full: string;
  api: string;
  thumb: string;
}
export interface GenProgress {
  total: number;
  done: number;
  phase: "prep" | "cards";
}

export const DEFAULT_FONT = `Pretendard, -apple-system, "Noto Sans KR", "Apple SD Gothic Neo", sans-serif`;
export const SERIF_FONT = `"Nanum Myeongjo", "Noto Serif KR", AppleMyungjo, Batang, Georgia, serif`;
// System-font stacks only (PNG export runs with skipFonts — no webfont loading).
export const MONO_FONT = `ui-monospace, "SF Mono", Menlo, Consolas, "Nanum Gothic Coding", monospace`;

export function defaultTheme(): Theme {
  return {
    background: "#ffffff",
    textColor: "#191919",
    accent: "#2563eb",
    fontFamily: DEFAULT_FONT,
  };
}
