# Changelog

All notable changes to Card News Studio. This project uses simple
`MAJOR.MINOR.PATCH` versions; a running local copy compares its version against
the deployed one and prompts an update when it's behind (see
[ARCHITECTURE.md](ARCHITECTURE.md#hosted-vs-local-mode)).

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
