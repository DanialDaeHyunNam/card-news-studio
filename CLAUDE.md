# Card News Studio — agent handoff notes

AI card news maker: topic → Claude drafts a themed card set → user refines on a
canvas (drag + smart guides + AI chat) → PNG export. Built 2026-07-06. This file
is the agent working context; the public-facing docs are `README.md` (overview +
quickstart), `ARCHITECTURE.md` (deep technical), and `CONTRIBUTING.md` (how to
extend). **This repo is open source (MIT)** — keep README/docs in English, no
secrets in code, `.env.local` only.

## Commands

```
bun install        # deps: next 16.2 / react 19.2 / ts 6 / @anthropic-ai/sdk / html-to-image
bun dev            # http://localhost:3000
bun run build      # typecheck + prod build — run after EVERY change
```

No tests. Verification = `bun run build` + driving the UI. AI routes need at
least one provider key in `.env.local` (`ANTHROPIC_API_KEY` and/or
`OPENAI_API_KEY` — see `.env.example`), or paste one in the app's 🔑 key modal
(dev-only, writes `.env.local` + `process.env`, no restart needed). The UI
auto-selects a model whose key is connected.

## Architecture

- **No server state, no DB.** Projects live in localStorage (`cardnews.projects.v1`).
  Route handlers exist only so the API key never reaches the client.
- **Data model** (`lib/types.ts`): Project → cards[] → elements[] (text/shape/image).
  Coordinates are **percent of the card**; `fontSize`/`radius` are **px at 1080-wide
  export scale**. One renderer (`components/CardView.tsx`) serves canvas, thumbnails,
  and the off-screen 1080px export node — keep it the single source of truth.
- **AI routes** (`app/api/*`): model registry in `lib/models.ts` — Claude (Opus 4.8 /
  Sonnet 4.6 / Haiku 4.5) AND OpenAI (GPT-5.5 / 5.4 / 5.4-mini / 5.4-nano, pricing
  verified 2026-07 from the OpenAI pricing page) implemented; Gemini is a key-slot
  placeholder. Dispatcher is `lib/ai.ts`: Anthropic via official SDK + structured
  outputs; OpenAI via chat/completions with `response_format: json_object` +
  schema embedded in the system prompt (our normalizers tolerate loose JSON), vision
  via `image_url` data URLs, `max_completion_tokens` (GPT-5.x rejects `max_tokens`).
  Every call returns a `usage` event (tokens + cost; Anthropic cache = 0.1×/1.25×
  multipliers, OpenAI cached input = explicit `cachedInPerMTok`) accumulated into
  `project.usage` (`lib/usage.ts`) — Editor topbar ⚡ chip popover. `/api/keys`
  manages all provider env vars (GET booleans, POST dev-only writes .env.local +
  process.env). Model is per-project (`project.model`), selectable in Home hero and
  Editor topbar; on keys load both auto-switch to a model whose key is connected.
- **i18n** (`lib/i18n.tsx`): flat `[ko, en]` dict + LangProvider (localStorage
  `cardnews.lang`, defaults from navigator.language) + `useLang()` → `{lang, t}`.
  Globe dropdown = `components/LangSwitch.tsx` (Home nav + Editor topbar).
  Templates are localized via `getTemplates(lang)` (copy hand-written per language,
  NOT machine-translated). `lang` is sent to generate/chat so AI copy matches the UI
  language. Server error strings are still Korean-first — localize if it matters.
  - `generate`: topic (+ optional reference theme/texts for style continuity, + optional
    youtube `source` with transcript — prompt tells the model to quote real 자막 lines) → `{theme, cards}`
  - `chat`: sanitized project JSON (image srcs stripped) + selection + history +
    image attachments → `{reply, operations[]}`
  - `photo`: same-origin proxy for Lorem Picsum (`/api/photo?id=N&w=&h=&g=1`) so
    AI-picked photo backgrounds survive html-to-image export (no CORS). The AI
    chooses from the curated library in `lib/photos.ts` — IDs + bilingual tags
    injected into both prompts via `photoLibraryPrompt(cardH)`. Tags were written
    by actually viewing each photo; when adding entries, LOOK at the image first
    (contact-sheet trick: grid HTML + headless screenshot). Never guess IDs/tags.
  - `youtube`: URL → title/author/caption lines WITHOUT an API key, via the InnerTube
    player API with the **ANDROID client** (the watch-page timedtext URLs return empty
    bodies without a proof-of-origin token; WEB client returns no tracks — verified 2026-07).
    Response may be json3 or timedtext XML; `parseCaptions` handles both. The Home hero
    detects YouTube URLs in the topic input and runs 자막 fetch → generate.
- **Operations** are the edit language the AI speaks (`update_element`, `add_element`,
  `remove_element`, `update_card`, `add_card`, `remove_card`, `update_theme`).
  Applied client-side in `lib/ops.ts` — pure, clamps numbers, skips unknown ids.
- **Attachment protocol**: chat images go to the model resized (≤1200px); the AI
  inserts them via `src: "attachment:N"`, and `lib/ops.ts` substitutes the original
  data URL kept client-side. Chat history persists only tiny thumbnails
  (localStorage ~5MB quota — `lib/store.ts` alerts on overflow).
- **Smart guides** (`lib/snap.ts`): on drag, edges/centers snap to other elements'
  measured DOM rects (percent-space) and card 0/50/100, threshold 6px. Guides render
  as `.guide` divs inside CardView.
- **Undo**: snapshot stack in `Editor.tsx` (`historyRef`, cap 60). Every mutation
  goes through `mutate()`; push a snapshot before each discrete gesture (drag start,
  inspector focus, chat apply), not per keystroke.
- **Export**: off-screen CardView at 1080px + `html-to-image` `toPng`
  (`skipFonts: true` — system font stack only).

## UI / design

opus.pro-inspired: black bg (`#050505`), pill buttons (white primary), bold tight
headings, dark panels. All styles in `app/globals.css` (no Tailwind). Editor layout:
card strip (left) / canvas / inspector / AI chat (right). Home = hero with the
pill-shaped topic bar.

## Conventions & gotchas

- Single-page client app: `app/page.tsx` returns null until localStorage loads
  (hydration safety) — SSR HTML is intentionally empty.
- `Editor.tsx` uses `projectRef` for pointer-event handlers (stale closure guard);
  global pointermove/pointerup listeners drive drag — don't move them onto elements.
- Thumbnails must keep `pointer-events: none` (`.thumb-preview *`).
- When changing the element model: update types.ts + schemas.ts + prompts.ts +
  ops.ts (normalize/patch) + CardView render together.
- Model choice is deliberate (`claude-opus-4-8`); don't downgrade for cost without
  the owner's say-so.
- **Hosted vs local mode**: the tool only runs locally (keys in `.env.local`,
  projects in localStorage), so a public deploy can't run it. `app/layout.tsx`
  stamps `<html data-hosted>` when `process.env.VERCEL` (or `HOSTED_DEMO=1`);
  `useHosted()` (`lib/hooks.ts`) reads it. When hosted, `Home.tsx` shows a
  "runs locally" banner and routes every real action (generate / template /
  blank / open) to `components/InstallGuide.tsx` (bilingual macOS/Windows guide,
  mirrors all-libertas). `/` is statically prerendered → the flag bakes at BUILD
  time, which is correct on Vercel (VERCEL=1 during build). Preview locally with
  `HOSTED_DEMO=1 bun dev`. **Deploy from `card-news/` only**, never a parent dir.

## Status / TODO ideas

- Done: generate, canvas drag/snap/resize, inline text edit, inspector, multimodal
  chat edit with attachments, style-reference generation, undo, PNG export, dark UI,
  YouTube URL → 카드뉴스 (transcript pipeline above), per-element `fontFamily` + `letterSpacing`(em) on text
  (`SERIF_FONT` in types.ts; Inspector has a 고딕/명조 select; image element `src` accepts
  data URLs and same-origin `/...` paths),
  template gallery (`lib/templates.ts` — 10 starter sets, instantiated via normalizeCard;
  layout-inspired only — copy and accent colors are deliberately ORIGINAL so no
  template traces back to a real creator's content: 인생스토리 블랙+명조+프레임사진(테라코타),
  영어 한 표현 딥틸+민트, 버건디 플레이북 듀오톤(grayscale 사진+와인 스크림)+명조,
  한 장 설명 쿨그레이+블루. Keep it that way when adding templates;
  all use the photo + tinted dim overlay style: `linear-gradient(...), url(/templates/x.jpg)
  center/cover` as the card background string. Photos in `public/templates/` from
  Lorem Picsum / Unsplash license — free to use, bundled deliberately for offline use),
  pure-CSS "how it works" demo loop (`components/HowItWorks.tsx`, 10s keyframes in
  globals.css), OpusClip-style footer (`components/Footer.tsx`),
  AI photo backgrounds — chat "어울리는 배경 사진 깔아줘" (quick chip `chat_q4`) or
  generate-time request picks from the curated free library (`lib/photos.ts` +
  `/api/photo` proxy), always with a theme-tinted scrim over the photo.
- `lib/site.ts`: `GITHUB_URL` → https://github.com/DanialDaeHyunNam/card-news-studio (public, MIT)
  and the owner's Threads/X links. Header button + footer star CTA read it.
- Not done: multi-select, z-order controls, redo, zip export, font picker,
  mobile layout polish, drag-reorder for card strip.
