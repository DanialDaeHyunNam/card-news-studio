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

- **No DB; the local filesystem is the store.** On dev, projects live in
  `data/projects/<id>.json` via `/api/projects` (dev-only, like `/api/keys`) —
  no localStorage quota, survives clearing browser data, port changes are safe,
  and copying `data/` + `public/uploads/` is a full backup. `lib/store.ts` picks
  the mode once per load (GET `/api/projects` answers → fs; 403/unreachable →
  localStorage `cardnews.projects.v1`, which is what hosted/prod uses). First fs
  load migrates any legacy localStorage projects once (`cardnews.migrated.v1`
  marker stops them resurrecting after deletes). Saves are debounced 300ms and
  the route only rewrites files whose content changed. `data/` is gitignored —
  user content must never reach the public repo. Route handlers otherwise exist
  only so the API key never reaches the client.
- **Project export/import** (`lib/transfer.ts`): per-project ⬇ on the Home grid
  downloads a self-contained `.cardnews.json` (every `/uploads/` image inlined
  as a data URL); ⬆ Import (Home; lives in the templates header when there are
  no projects yet) re-files inlined images through `/api/asset` and always
  assigns a fresh project id. Foreign JSON is sanitized through `normalizeCard`.
- **Data model** (`lib/types.ts`): Project → cards[] → elements[] (text/shape/image).
  Coordinates are **percent of the card**; `fontSize`/`radius` are **px at 1080-wide
  export scale**. One renderer (`components/CardView.tsx`) serves canvas, thumbnails,
  and the off-screen 1080px export node — keep it the single source of truth.
  CardView always LAYS OUT at 1080px and shrinks with a CSS `transform: scale()` —
  never multiply font sizes by a scale factor: glyph advances don't scale linearly,
  so numerically-scaled text wraps differently per view (thumbnail ≠ canvas ≠ PNG).
  Selection chrome inside the scaled node (outline/resize handle/guides) multiplies
  by `--ui` (= 1/scale) to keep constant on-screen size. The inline text editor
  (`Editor.tsx` InlineTextEditor) uses the same trick.
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
- **Claude subscription provider** (`lib/claude-cli.ts`, provider `claude-cli`,
  model ids `claude-cli:opus|sonnet|haiku`): local dev only — spawns the user's
  installed `claude -p` (stream-json in/out, `--json-schema`, `--tools ""`,
  `--setting-sources ""`, `--strict-mcp-config`, neutral tmp cwd) so generation
  runs on their Claude plan, no API key. The child env has `ANTHROPIC_API_KEY`
  STRIPPED (else the CLI bills the API). `--bare` is unusable (disables OAuth).
  `/api/keys` reports the pseudo flag `CLAUDE_CLI` when a working binary is found
  (`CLAUDE_CLI_PATH` overrides); the picker hides the group otherwise and it's
  first in PROVIDER_ORDER so it auto-selects. Only the StructuredOutput tool's
  `input_json_delta` is streamed (prose is suppressed). Cost recorded as $0.
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
- **Photo sets** (Home 📷 tray, `lib/photoset.ts`): user photos (drag/paste/pick;
  HEIC → JPEG via dev-only `/api/heic` = macOS `sips`) are sent to the model at
  ≤800px so it places copy off the subject; `photoSetRules` (prompts.ts) overrides
  the single-anchor/accent-bar rules for a reels-carousel look. The model writes
  TEXT ONLY — `dressPhotoCard` puts photo `k mod N` full-bleed behind card k (N<M
  loops, N>M stops), a gradient scrim on the text's half, and `shadow: true` on
  text (new TextElement/role style field). Card count `0` = Auto (model picks 3–10).
  Reference material (reels script/analytics text + screenshots) rides along as
  `refText`/`refImages`. Failed runs hand the inputs back to Home (`lastCfg`).
- **Create wizard** (Home, `components/CreateWizard.tsx` + `lib/wizard.ts`) replaces the
  old single input bar. Steps, in order: ① format reference — a post URL first
  (Instagram/LinkedIn/TikTok), template / previous project as fallback, or none;
  ② goal — "video → carousel" (video link auto-fills subtitles: YouTube via
  `/api/youtube` + SegmentPicker for long videos, TikTok/IG via `/api/reference`;
  + "anything else to include") or "new card set" (the story = prompt core);
  optional analytics notes/screenshots; ③ design — card count (auto default),
  design notes (highest-priority styling input), photos, brand color; ④ ratio —
  auto-suggested from the reference's real slide aspect until the user picks;
  ⑤ model. `WizardState` lives in Root (page.tsx) so a failed run keeps every
  answer; reset only on success. Maps to GenConfig/GenerateBody via `toGenConfig`
  (`mode`, `script`, `designNotes`, `referencePost`, `templateRef`).
- **Create harness** (`lib/harness.ts`): analyze → (ask ↔ answer)* → generate.
  After step ⑤, if there are photos or reference slides, `/api/plan`
  (`buildPlanRequest` + `planSystem` + `planSchema`) reads the reference's photo
  COMPOSITION and returns card count + per-card layout (`full | stack2 | side2 |
  stack3 | grid4 | none`, rects in `LAYOUT_SLOTS`, lib/photoset.ts) + which
  photo goes in each slot (varied: different photos within a card, similar
  shots not adjacent) + `sufficient`. Insufficient → the wizard shows the
  model's question (reasons + options) and the user uploads more / picks /
  types an answer → re-plan with the dialogue. Sufficient → generation with
  `plan` (photoPlanRules: text per slot; client `dressPlannedCard` lays the
  photos). Verified live 2026-09 on the subscription (reference = 8× stack2).
- **Photo framing**: ImageElement `focusX/focusY` (object-position %, default
  50) + `zoom` (1–3, transform-origin at the focus). On the canvas a plain drag
  on a cover-fit photo PANS inside the frame (Editor drag mode "pan"; span =
  cover overflow×zoom + frame×(zoom−1) so the photo tracks the pointer); ⌥/Alt+
  drag moves the frame. Inspector: zoom slider + reset. AI chat reframes via
  focusX/Y/zoom ("face is cut off") instead of moving x/y.
- **Chat recipes** (chatSystem): layout presets with slot rects ("make this a
  top/bottom two-photo slide" → first photo to slot 1, new image at index 1,
  texts + their decorative bars into their slots; no photo given → reuse a
  different photo from the set) and "remove the accent color" (theme.accent =
  textColor, accent text → textColor, remove small accent shapes). Verified
  2026-09 with the ops applied through applyOperations.
- **Output language** (`lib/lang.ts`): copy language is NOT the UI language.
  Wizard step 2 "Output language" = Auto (default) | explicit. Auto detects
  from the source text (script → story → notes) by script: Hangul/Kana/Han
  (简/繁)/Thai/Cyrillic/Vietnamese → that language; other Latin → "same
  language as the source". `outputLangRule` feeds both plan and generate and
  guards against drift toward the Korean prompt text / the reference post's
  language. Chat copy follows the existing slides' language.
- **Creator brief** (`Project.brief`, `CreatorBrief`): generation must decide
  audience / purpose / contentType / keepOriginal / languageNote BEFORE writing
  copy (generateSchema `brief` first); the wizard's "Purpose & audience" field
  (`intent`) overrides inference. keepOriginal = what the content teaches or
  names (e.g. the Korean words in an English lesson) — never translated. The
  brief is sent with every chat edit and the chat can refine it with the
  `update_brief` op (merged; keepOriginal accumulates). Verified 2026-09 on the
  "Korean 개 for English speakers" case (gen + one-shot chat fix).
- **Reference style spec** (`RefStyle`, lib/photoset.ts): the analysis step
  also MEASURES the reference — dim + scrim, text color/effect, anchor/align,
  hierarchy (levels, headline/body px, weight, letter case, words per slide),
  storyPattern (refrain / contrast / numbering…) and voice. It is binding for
  generation (`referenceStyleRules`; the hardcoded white/700/56–72 photo rules
  only apply when there is no spec) and for the client dressing (image dim,
  scrim mode, shadow). Verified 2026-09: reference = centered lowercase single
  lines + "post a video" refrain → output kept 48px/600/center + a Korean refrain.
- **Reference library** (`lib/references.ts`, `/api/references` →
  data/references.json; localStorage fallback with ≤240px thumbs): every loaded
  reference is recorded (use count, last used), ★ favorites can be saved ahead
  by link. Home section `ReferenceLibrary` + step-1 quick-pick strip; picking an
  entry converts its stored slides back to model-sized data URLs
  (`entryToPost`). Existing projects' `reference` backfilled once.
- **Track parity (subscription ≡ API)**: every step is an `AiRequest` with a
  pinned `effort` (plan/generate high, chat medium, video-bg low) applied on
  every track — Anthropic `output_config.effort`, CLI `--effort`, OpenAI
  `reasoning_effort`. The Anthropic body is built ONCE in `lib/ai-anthropic.ts`
  for both the server SDK (`client.beta.messages.stream`) and hosted raw fetch:
  adaptive thinking, cache breakpoint after the image prefix (re-plans reuse
  the photos), server-side refusal `fallbacks: "default"` on 5.x models,
  refusal → readable error. The API model list must track what the CLI aliases
  resolve to (verified 2026-09: opus → claude-opus-5-5, sonnet →
  claude-sonnet-5-5); Opus 5.5's API effort default is `medium`, so pinning is
  what keeps API output at subscription quality. SDK ≥ 0.129 (xhigh, fallbacks).
- **Editor**: ‹ n/N › card nav (+ ←/→ when nothing is selected) and 📎 reference
  compare (`components/ReferenceCompare.tsx`, `project.reference` saved at
  generation as ≤480px copies; attach one by link for older projects).
- **Brand color** has three modes in the wizard: Auto / Custom / None
  (`noAccent` → monochrome prompt + accent = textColor). localStorage
  `cardnews.accent` may hold "none" — the Editor ignores it as a color.
- **Reference posts** (`/api/reference`, `lib/scrapers/*`, shared type
  `ReferencePost` in `lib/reference.ts`), no login. Verified 2026-09:
  Instagram = crawler (Googlebot UA) page's inline `carousel_media` (GraphQL 403,
  embed no media, `?__a=1` 500); LinkedIn = crawler page ld+json (text, likes,
  comments) + `data-native-document-config` → manifest → every document page
  image + per-page transcript; TikTok = browser-UA `__UNIVERSAL_DATA_FOR_REHYDRATION__`
  (caption, plays/likes/shares/saves, `imagePost` photos, WebVTT `subtitleInfos`)
  — rate-limited/flaky, falls back to oEmbed (`partial: true`). ANY scrape
  failure → the wizard asks for screenshots (`screenshotReference`, platform
  "upload"). The editor chat accepts the same links (slides added AFTER
  attachments so "첨부 N" indices don't shift; existing photos are user content —
  never removed unless asked).
- **Claude subscription provider** (`lib/claude-cli.ts`, provider `claude-cli`,
  model ids `claude-cli:opus|sonnet|haiku`): local dev only — spawns the user's
  installed `claude -p` (stream-json in/out, `--json-schema`, `--tools ""`,
  `--setting-sources ""`, `--strict-mcp-config`, neutral tmp cwd) so generation
  runs on their Claude plan, no API key. The child env has `ANTHROPIC_API_KEY`
  STRIPPED (else the CLI bills the API). `--bare` is unusable (disables OAuth).
  `/api/keys` reports the pseudo flag `CLAUDE_CLI` when a working binary is found
  (`CLAUDE_CLI_PATH` overrides); the picker hides the group otherwise and it's
  first in PROVIDER_ORDER so it auto-selects. Only the StructuredOutput tool's
  `input_json_delta` is streamed (prose is suppressed). Cost recorded as $0.
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
- **Photo sets** (Home 📷 tray, `lib/photoset.ts`): user photos (drag/paste/pick;
  HEIC → JPEG via dev-only `/api/heic` = macOS `sips`) are sent to the model at
  ≤800px so it places copy off the subject; `photoSetRules` (prompts.ts) overrides
  the single-anchor/accent-bar rules for a reels-carousel look. The model writes
  TEXT ONLY — `dressPhotoCard` puts photo `k mod N` full-bleed behind card k (N<M
  loops, N>M stops), a gradient scrim on the text's half, and `shadow: true` on
  text (new TextElement/role style field). Card count `0` = Auto (model picks 3–10).
  Reference material (reels script/analytics text + screenshots) rides along as
  `refText`/`refImages`. Failed runs hand the inputs back to Home (`lastCfg`).
- **Instagram** (`/api/instagram`): a post link in the hero bar → every carousel
  slide + caption + like/comment counts, NO login — Instagram serves crawlers
  (Googlebot UA) the post's media JSON inline (`carousel_media`). Verified
  2026-09: GraphQL doc_id → 403, embed page → no media, `?__a=1` → 500. Slides go
  to the model as a benchmark ("레퍼런스 슬라이드 N"); text beside the link = topic.
  The editor chat does the same (`lib/instagram.ts` shared client helper): a link
  in a chat message → slides + caption ride along in `ChatBody.instagram` (added
  AFTER attachments so "첨부 N" indices don't shift; slides are look-only) and the
  model restyles the CURRENT cards — wording kept, and existing photos are the
  user's content: never removed unless explicitly asked (a real run deleted them
  before that rule existed). Cached per URL in ChatPanel.
- **Operations** are the edit language the AI speaks (`update_element`, `add_element`,
  `remove_element`, `update_card`, `add_card`, `remove_card`, `update_theme`).
  Applied client-side in `lib/ops.ts` — pure, clamps numbers, skips unknown ids.
  `letterSpacing` is clamped font-size-aware (`clampTracking`: bigger type → tighter
  cap; wide tracking only survives on small labels) on every AI path — generation,
  `update_element`, `update_style` — because models occasionally emit absurd 자간 on
  Korean headlines. Prompts (`lib/prompts.ts`) state the same rule; keep both in sync.
- **@-mentions** (`lib/mentions.ts`, ChatPanel): typing "@" opens a preview picker
  of the project's cards (CardView thumbs) and images (card images + recent
  `/uploads` via GET `/api/asset`, dev-only) → tokens `@카드N`/`@사진N`
  (en `@cardN`/`@imgN`) + chips. On send, tagged IMAGES join the turn's
  attachments (model sees them; `attachmentOriginals` = their original src, so
  `attachment:K` resolves to the same `/uploads` URL, not a copy) and tagged
  cards map to ids — both via `ChatBody.mentions` → "@멘션" block. Token match is
  exact (`@사진3` ≠ `@사진30`, `hasToken`). Separate from the Inspector's @
  buttons, which insert descriptive text.
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

Dark, bold aesthetic: black bg (`#050505`), pill buttons (white primary), bold tight
headings, dark panels. All styles in `app/globals.css` (no Tailwind). Editor layout:
card strip (left) / canvas / inspector / AI chat (right). Home = hero + the
create wizard (+ "blank canvas" / import under it), projects, how-it-works.
Templates no longer have their own Home gallery — they're the wizard's
step-1 fallback reference, with "Open as-is" for manual editing.

## Conventions & gotchas

- **Naming**: the app is "Card News Studio" (unchanged), but user-facing English
  says **carousel / slides** (what Instagram, LinkedIn and TikTok users call it;
  "card news" is a Korean-only term) and Korean says 카드뉴스 / 카드. Code and
  data model keep `card`/`cards` (Project.cards, CardView) — don't rename those.

- Single-page client app: `app/page.tsx` returns null until localStorage loads
  (hydration safety) — SSR HTML is intentionally empty.
- `Editor.tsx` uses `projectRef` for pointer-event handlers (stale closure guard);
  global pointermove/pointerup listeners drive drag — don't move them onto elements.
- Thumbnails must keep `pointer-events: none` (`.thumb-preview *`).
- When changing the element model: update types.ts + schemas.ts + prompts.ts +
  ops.ts (normalize/patch) + CardView render together.
- Model choice is deliberate (`claude-opus-5-5`, matching the subscription's
  opus alias); don't downgrade for cost without the owner's say-so.
- **Hosted vs local mode (v0.8.0 — hosted RUNS now, via BYOK)**: `app/layout.tsx`
  stamps `<html data-hosted>` when `process.env.VERCEL` (or `HOSTED_DEMO=1`);
  `useHosted()` reads it (non-React: `isHostedRuntime()` in `lib/ai-transport.ts`).
  Local = `.env.local` keys + server routes + fs projects (UNCHANGED). Hosted =
  keys in browser storage (`lib/client-keys.ts`, session-default + "remember"
  opt-in) and AI calls **browser→provider direct** (`lib/ai-client.ts`, raw
  fetch SSE; Anthropic needs the `anthropic-dangerous-direct-browser-access`
  header). Invariants: ① prompts are built ONLY in `lib/requests.ts` (shared by
  routes and browser path — never fork them) ② `lib/ai-compat.ts` is the one
  isomorphic OpenAI/Gemini adapter ③ the key-panel disclaimer is a CONTRACT —
  keys only in this browser, only to the provider domain; if code would break a
  sentence, fix the code, and keep `next.config.ts` CSP `connect-src` in sync
  with the provider list. All three providers verified CORS-open (2026-07-15
  preflight: Anthropic `*`, OpenAI/Gemini echo origin). Hosted UX: two-track
  bar + `DiffModal`, editor "browser mode" pill (dismiss = forever via
  `cardnews.hostedNoteDismissed`), `/privacy`, footer "erase all data"
  (`lib/wipe.ts`). Analytics: `lib/analytics.ts` trackEvent wrapper ONLY —
  event props never contain typed content or keys; custom events are Pro-only
  (currently no-op on Hobby). `/` bakes the flag at BUILD time (correct on
  Vercel). Preview with `HOSTED_DEMO=1 bun dev`. **Deploy from `card-news/`
  only**, never a parent dir.
- **Versioning / releases**: `package.json` `version` is the single source (inlined
  as `NEXT_PUBLIC_APP_VERSION` by `next.config.ts`, exposed via `/api/version`,
  shown in header/footer). A local copy compares against the canonical deploy's
  `/api/version` (`lib/hooks.ts` `useUpdateCheck` → `lib/site.ts` `isNewerVersion`,
  `CANONICAL_URL`) and shows an "update available" chip/guide when behind. So the
  update prompt ONLY fires if you **bump the version every release**. Full release
  checklist (bump → CHANGELOG.md → commit → `git tag` + `gh release create` →
  redeploy) is in `CONTRIBUTING.md` → Releasing. Keep `CHANGELOG.md` current — the
  version chip links users to GitHub releases.

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
  globals.css), marketing-style footer (`components/Footer.tsx`),
  AI photo backgrounds — chat "어울리는 배경 사진 깔아줘" (quick chip `chat_q4`) or
  generate-time request picks from the curated free library (`lib/photos.ts` +
  `/api/photo` proxy), always with a theme-tinted scrim over the photo.
- `lib/site.ts`: `GITHUB_URL` → https://github.com/DanialDaeHyunNam/card-news-studio (public, MIT)
  and the owner's Threads/X links. Header button + footer star CTA read it.
- Not done: multi-select, z-order controls, redo, zip export, font picker,
  mobile layout polish, drag-reorder for card strip.
