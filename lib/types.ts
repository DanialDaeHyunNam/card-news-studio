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
}

export type CardElement = TextElement | ShapeElement | ImageElement;

export interface Card {
  id: string;
  background: string; // CSS color or gradient
  elements: CardElement[];
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
    | "update_style"; // change a role's shared typography → propagates to all same-role text
  cardId?: string;
  elementId?: string;
  index?: number;
  role?: string; // for update_style: which role's shared style to change
  patch?: Record<string, unknown>;
  element?: Record<string, unknown>;
  card?: { background?: string; elements?: Record<string, unknown>[] };
}

// Generation request from Home → Root, and the live progress Root feeds the Editor.
export interface GenConfig {
  topic: string;
  format: Format;
  cardCount: number;
  model: string;
  referenceId?: string;
  accent?: string; // fixed brand point color (hex); omitted = AI chooses
}
export interface GenProgress {
  total: number;
  done: number;
  phase: "prep" | "cards";
}

export const DEFAULT_FONT = `Pretendard, -apple-system, "Noto Sans KR", "Apple SD Gothic Neo", sans-serif`;
export const SERIF_FONT = `"Nanum Myeongjo", "Noto Serif KR", AppleMyungjo, Batang, Georgia, serif`;

export function defaultTheme(): Theme {
  return {
    background: "#ffffff",
    textColor: "#191919",
    accent: "#2563eb",
    fontFamily: DEFAULT_FONT,
  };
}
