# Card News Studio

**AI-powered card news maker for social media.** Type a topic — or paste an
article or a YouTube link — and Claude (or GPT, or Gemini) drafts a full themed
carousel: hook → body → CTA. Then refine it on a Figma-like canvas with smart
guides and an AI chat, and export PNGs.

> 주제 하나로 카드뉴스 한 세트. 주제·원문·유튜브 링크를 넣으면 AI가 카피와
> 레이아웃을 설계하고, 캔버스에서 자유롭게 다듬은 뒤 PNG로 내보냅니다.

Open source (**MIT**). Two ways to use it:

- **In the browser** ([card-news-zeta.vercel.app](https://card-news-zeta.vercel.app)) —
  works instantly: editing, templates and PNG export need no key, and AI runs on
  **your own API key**, stored only in your browser and sent **directly to the
  provider** — the server never sees your key or your content.
- **Installed locally** — the better home: projects are plain JSON files in the
  app folder (`data/projects/`), keys live in `.env.local`, and nothing ever
  leaves your machine. No server, no database, no account.

- 🧠 **Deep-dive on how it works:** [ARCHITECTURE.md](ARCHITECTURE.md)
- 🛠️ **Want to hack on it or add a model/template/language:** [CONTRIBUTING.md](CONTRIBUTING.md)

---

## Features

- **AI draft generation** — a topic/article/YouTube video in, a themed card set
  out, streamed card-by-card into the editor as the model writes it. Powered by
  structured JSON output.
- **Multi-provider** — Claude (Opus / Sonnet / Haiku), OpenAI (GPT-5.x), and
  Gemini share one dispatcher. The app auto-selects a good-value default for
  whichever provider's key you've connected.
- **Canvas editor** — drag anything anywhere with Figma-style smart guides (snap
  to other elements' edges/centers and the card center); inline text editing;
  full inspector (font, size, weight, color, alignment, tracking, line height).
- **AI chat editing (multimodal)** — select a card or element and ask for changes
  in plain language. Paste or drop images into chat and ask to place them; the
  original full-resolution image is preserved on export.
- **Layers & z-order** — reorder overlapping elements, background dim/scrim,
  per-element opacity, all controllable by hand or by the AI.
- **Brand color** — pin a point color; every element using it recolors together
  when you change it (a real design token, not a one-off value).
- **YouTube → cards** — paste a video URL; captions are fetched (no API key
  needed) and turned into a card set that quotes the real transcript.
- **Style continuity** — start a new set that inherits a previous project's theme
  and tone.
- **Templates** — 10 starter sets (bilingual copy), each a launchpad you make your own.
- **Formats** — 1:1 (1080×1080), 4:5 (1080×1350), 9:16 (1080×1920).
- **PNG export** — per card or the whole set, at full 1080-wide resolution.
- **Bilingual** — English / Korean throughout (UI, templates, and AI copy).
- **Project export / import** — download any project as a self-contained
  `.cardnews.json` (images inlined) and import it on another computer.
- **In-app keys** — paste a provider key in the 🔑 panel. Locally it's written
  to `.env.local`; in the browser it stays in browser storage (session-only by
  default, "remember" opt-in) and goes straight to the provider (BYOK).

## Quickstart (local)

You need [Node.js](https://nodejs.org) (which includes `npm`) and
[Git](https://git-scm.com). [Bun](https://bun.sh) works too and is faster.

```bash
git clone https://github.com/DanialDaeHyunNam/card-news-studio.git
cd card-news-studio
npm install          # or: bun install
npm run dev          # or: bun dev   → http://localhost:3000
```

Open http://localhost:3000, click **🔑 API Keys**, and paste an
[Anthropic](https://platform.claude.com/settings/keys) or
[OpenAI](https://platform.openai.com/api-keys) key. Generation unlocks the
instant a key is connected. (You can also `cp .env.example .env.local` and set
the keys there.)

## Local-first by design

There is still **no server-side product**: no account, no database, no stored
user data — in either mode.

- **Locally**, your API keys stay in `.env.local`; the browser only ever sees
  model *output*. Projects are JSON files under `data/projects/` (images in
  `public/uploads/`) — copying those two folders is a full backup, and deleted
  projects go to `data/trash/`, not straight to oblivion.
- **In the browser (hosted BYOK)**, your key lives in browser storage and AI
  requests go **from your browser straight to the provider's API** —
  the deployment's server handles neither. Projects live in `localStorage`
  (export to back up), and a Content-Security-Policy header enforces that
  scripts load only from the app itself and network calls go only to the
  supported providers. "Erase all data" in the footer wipes everything.

See [ARCHITECTURE.md → Hosted vs. local mode](ARCHITECTURE.md#hosted-vs-local-mode)
and the in-app [privacy notice](https://card-news-zeta.vercel.app/privacy).

## Stack

[Next.js 16](https://nextjs.org) (App Router, Turbopack) · React 19 · TypeScript ·
[@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) ·
[html-to-image](https://github.com/bubkoo/html-to-image). No Tailwind (hand-written
CSS in `app/globals.css`), no test framework — verification is `npm run build`
(typecheck + prod build) plus driving the UI.

## License

[MIT](LICENSE) — free to use, fork, and modify.
