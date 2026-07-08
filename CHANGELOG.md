# Changelog

All notable changes to Card News Studio. This project uses simple
`MAJOR.MINOR.PATCH` versions; a running local copy compares its version against
the deployed one and prompts an update when it's behind (see
[ARCHITECTURE.md](ARCHITECTURE.md#hosted-vs-local-mode)).

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
