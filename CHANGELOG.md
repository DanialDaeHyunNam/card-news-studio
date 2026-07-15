# Changelog

All notable changes to Card News Studio. This project uses simple
`MAJOR.MINOR.PATCH` versions; a running local copy compares its version against
the deployed one and prompts an update when it's behind (see
[ARCHITECTURE.md](ARCHITECTURE.md#hosted-vs-local-mode)).

## 0.8.0 — 2026-07-15

The hosted app now runs for real. Editing, templates and PNG export work with
no key at all; AI runs on your own key (BYOK), sent from your browser straight
to the provider — the server never sees your key or your content.

### Added
- **Hosted BYOK** — key panel stores keys in this browser (session-only by
  default, "remember on this browser" opt-in), with masked display, remove
  button, and an always-visible disclaimer whose provider name/domain follows
  the selected model. AI calls stream directly browser→provider
  (`lib/ai-client.ts`, raw fetch SSE; shared OpenAI/Gemini adapter in
  `lib/ai-compat.ts`). All three providers verified CORS-reachable.
- **Two-track landing (hosted)** — "Install locally" as the primary CTA plus a
  "what's the difference?" comparison modal (`DiffModal`); a dismissable
  "browser mode" pill in the editor links to the install guide.
- **Erase all data** — footer action wiping every `cardnews.*` entry from both
  browser storages (filesystem projects are untouched), with an export-first
  nudge.
- **/privacy** — bilingual privacy notice matching the actual architecture,
  linked from the footer and the key panel.
- **Vercel Web Analytics** — cookieless page views + a `trackEvent` wrapper for
  key clicks (generate / template / export / key save / guides). Event props
  never include typed content or keys. (Custom events light up on a Pro plan.)
- **Content-Security-Policy** — scripts self-only; `connect-src` limited to the
  app + the three provider APIs, enforcing the BYOK promise at the browser level.

### Changed
- Prompt assembly moved to `lib/requests.ts`, shared verbatim by the API routes
  (local) and the browser path (hosted) — the two modes cannot drift.
- Hosted YouTube flow runs the caption fetch/frame proxy through the app routes
  (keyless) and the frame *vision pick* on your key in the browser.
- App-wide link underlines removed (hover = color shift), per design language.

## 0.7.0 — 2026-07-10

Your projects now live on your disk, not in the browser — plus a portable
export/import for moving work between computers.

### Added
- **Filesystem project store** — on local dev, projects are saved as plain JSON
  files in `data/projects/<id>.json` (via the dev-only `/api/projects` route,
  same pattern as `/api/keys`). No more ~5MB localStorage quota, projects
  survive clearing browser data or changing the dev port, and backing up is
  copying `data/` + `public/uploads/`. Existing localStorage projects are
  migrated automatically on first load; the hosted demo (and prod builds)
  keep using localStorage as before.
- **Soft delete** — deleting a project moves its file to `data/trash/` instead
  of destroying it, so an accidental delete is recoverable.
- **Project export / import** — a ⬇ button on each project card downloads a
  self-contained `.cardnews.json` with every `/uploads/` image inlined; the
  ⬆ Import button (projects header, or the templates header on a fresh
  machine) re-files those images locally and always assigns a fresh project id,
  so re-importing never overwrites an existing project.

### Changed
- Saves are debounced (300ms) and only rewrite project files whose content
  actually changed. `data/` is gitignored — user content never reaches the
  public repo.

## 0.6.1 — 2026-07-09

Small follow-ups to 0.6.0.

### Fixed
- Shared-styles header no longer wraps into three cramped lines — the title
  gets its own line above the Ask-AI / add-role / unify buttons.

### Changed
- The AI-CLI install prompt now ends by asking the agent to relay a polite
  "star the repo if you like it" note (with the link) once the app is running —
  a transparent request the user decides on, not a hidden instruction.

## 0.6.0 — 2026-07-08

Backgrounds become editable layers, richer text styling, and a reorganized
inspector that hands off to the AI.

### Added
- **Card background as a layer** — the Layers panel pins a "Card background"
  row (live swatch, 🖼 badge when a photo is set, @-reference into chat). When
  the AI sets a photo via the card's CSS background, **"Detach image to a
  layer"** converts it into a regular full-bleed image element — the scrim
  becomes `dim` — so it can be selected, moved, dimmed, or deleted.
- **Italic & underline** — toggles on text elements and in role shared styles,
  plus AI support (`update_element` / `update_style` understand both).
- **Font family in shared styles** — each role row now edits its font (with a
  new mono stack); AI-set stacks outside the list show as "custom".
- **Inspector tabs** — the no-selection panel splits into **Text styles**
  (per-role typography) and **Design** (card background + theme palette);
  clicking the background layer row jumps to Design.
- **Theme colors that do something** — accent edits behave exactly like the
  brand swatch (recolor cascade + brand sync); background/text edits recolor
  cards and text still using the old default (individually edited elements
  keep their values).
- **"Ask AI" buttons** — inspector sections (shared styles, card background,
  theme) drop a ready-made request stub into the chat input.

### Changed
- Chat prompt now prefers element-based photo backgrounds (`add_element` at
  index 0) so new AI-set backgrounds arrive as editable layers by default.
- Custom select chevrons with breathing room, wider gaps between inspector
  sections, and a contained background-image preview.

## 0.5.0 — 2026-07-08

Card reordering by drag, subject-on-solid-backdrop separation, role-typed
templates, true-WYSIWYG previews, and lighter local storage.

### Fixed
- **Previews now wrap text exactly like the canvas** — thumbnails, the canvas,
  and the exported PNG all lay text out at the same 1080px reference width and
  are shrunk visually with a CSS transform, so a title can no longer break into
  three lines in the strip but two on the canvas. Inline text editing uses the
  same trick, so line breaks don't shift while editing.
- **Letter-spacing guardrails** — the model occasionally emitted absurd tracking
  on Korean headlines. Spacing is now clamped relative to font size (bigger type
  → tighter cap) on every AI path — generation, element patches, and role-style
  updates — and both prompts state the numeric rule.

### Added
- **Drag-to-reorder cards** — grab a card in the strip and drop it anywhere;
  the ↑↓ buttons still work for one-step nudges.
- **Separate the subject (no cutout)** — for a photo shot on a solid backdrop
  (e.g. a person on flat orange), the app reads the backdrop color by clustering
  the image corners, paints the card that color, and shrinks/moves the image so
  only the subject appears to float. One click in the inspector ("Shrink subject"
  / "Backdrop → card"), or ask in chat — the detected color is sent to the model.
- **Role-typed starter templates** — every built-in template now assigns a role
  to each text element and ships a shared per-role style, so opening one shows
  the consistency system live. Also fixes invisible headlines on the One-Pager
  (white text on a light card).

### Changed
- **Templates open as a preview** — picking a template or a blank card no longer
  saves it immediately; it joins your project list only once you actually edit
  it. Browsing templates no longer clutters the list.
- **Inspector-added images go to disk** — the inspector's "+ Image" now writes to
  `public/uploads` (like chat attachments) instead of embedding a data URL, so
  projects stay well under the ~5MB localStorage budget.

## 0.4.0 — 2026-07-08

Reusable chat images and a text-role consistency system.

### Added
- **Reusable chat images** — an attached image is saved to a local file
  (`public/uploads`, dev-only `/api/asset`) and referenced by a short URL, so the
  AI can use it as a card background and copy it onto other cards (data URLs
  couldn't do either). `attachment:N` now substitutes into card backgrounds too.
- **Text roles + shared styles** — each text is typed by role (overline, mega,
  title, body, caption — extensible), and each role has one shared style. Same-
  role text stays consistent across cards; generation enforces it. Fixes the
  "cards drift to different sizes" problem structurally.
- **Prompt-level role control** — an `update_style` op lets one chat line unify a
  role ("make body 34 everywhere"); the system prompt documents each role's
  meaning and the hierarchy mega > title > overline ≈ body > caption.
- **Shared-styles inspector panel** — edit a role's size/weight/color and every
  card follows; per-element edits override just that card (with a reset). Add
  custom roles with **+ Role**, and **Unify** snaps an inconsistent set together.
- **@-reference into chat** — @ buttons on layers/roles drop a precise reference
  (a role = all of them, or one element) into the chat input.
- **Clickable "what changed"** — expand the "N changes applied" marker to see a
  brief list, plus a persistent "Working…" status while a request runs.

## 0.3.0 — 2026-07-08

Better long-video handling and video-frame backgrounds for YouTube.

### Added
- **Long-video segment picker** — YouTube videos ≥20 min open a picker (start +
  length) so you choose which window becomes cards, instead of silently using
  only the start of the transcript.
- **AI-picked video-frame backgrounds** — without downloading the video, the free
  YouTube thumbnail frames (poster + 3 auto-sampled) are shown to the vision
  model, which picks the best background frame and a matching accent. The chosen
  frame becomes the hook card's background with a dark scrim. New `/api/frame`
  (same-origin thumbnail proxy) and `/api/video-bg` (vision pick) routes.

### Changed
- YouTube generation now pre-fetches captions before opening the editor, so the
  segment picker and frame analysis can run first.

## 0.2.0 — 2026-07-07

Deployment, guides, and version awareness on top of the core app.

### Added
- **Hosted showcase mode** — deploy the landing page (e.g. to Vercel) as a
  preview. The canvas is fully explorable, but anything needing a local key
  (generate, AI chat, connecting a key) opens an install guide instead.
- **Install guide** — bilingual macOS/Windows walkthrough with copyable terminal
  blocks. An **AI coding CLI one-liner** is the recommended path; manual
  Node/Git + clone is the fallback. In-guide KO/EN language toggle.
- **Version awareness** — the app shows its version in the header and footer. A
  local copy checks the canonical deployment's `/api/version` and shows an
  "update available" chip + update guide (AI-CLI one-liner or manual `git pull`)
  when it's behind.
- **Streaming AI** — generate/chat stream over SSE with a client-side
  partial-JSON parser; cards render as they're written.
- **Multi-provider model picker** — Claude, OpenAI (GPT-5.x), and Gemini with
  good-value defaults per provider.
- **Layers & brand color** — z-order controls, background dim, per-element
  opacity, and a brand accent that recolors every element using it.
- **Slideshow preview** for a finished card set.
- **Docs** — rewritten README, plus ARCHITECTURE.md and CONTRIBUTING.md.

### Changed
- Removed the "One Expression" template (9 templates remain).
- Dropped named design-reference brands from the source in favor of neutral
  descriptions.

## 0.1.0 — 2026-07-06

Initial release.

### Added
- **AI draft generation** — a topic (or article, or YouTube link) becomes a
  themed hook → body → CTA card set via structured output.
- **Canvas editor** — drag with Figma-style smart guides, inline text editing,
  a full inspector, and undo.
- **Multimodal AI chat editing** — edit the selected card/element in natural
  language; paste or drop images to place them.
- **Templates** — starter sets with original copy and hand-written localization.
- **YouTube → cards** — captions fetched without an API key, turned into a set.
- **AI photo backgrounds** — the model picks from a curated free-photo library.
- **PNG export** — per card or the whole set at full 1080-wide resolution.
- **In-app keys** — paste a provider key; it's written to `.env.local` and
  applied instantly. No server state; projects live in localStorage.
- **Bilingual** — English / Korean throughout.
