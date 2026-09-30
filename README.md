# Card News Studio

**AI carousel maker for Instagram, LinkedIn and TikTok.** Show it a post that
worked and tell it your story (or give it a video to unfold) — Claude (or GPT,
or Gemini) studies the reference's layout, photo composition, type hierarchy
and storytelling, then builds your carousel in that format. Refine it on a
Figma-like canvas with smart guides and an AI chat, and export PNGs.

> 잘 된 게시물 하나로 카드뉴스 한 세트. 레퍼런스와 하고 싶은 이야기(또는 영상)를
> 주면 AI가 그 구성·사진 구도·글 위계·스토리텔링을 따라 설계하고, 캔버스에서
> 다듬은 뒤 PNG로 내보냅니다.

Open source (**MIT**). Two ways to use it:

- **Desktop app (macOS)** — [download it](https://card-news-zeta.vercel.app/#download):
  signed, notarized, auto-updating. 3 days free, then a one-time license.
  AI runs on **your own Claude subscription** (via an installed, logged-in
  Claude Code — no key, $0 per generation) or **your own API key**, kept in the
  macOS keychain. Projects are files on your disk. No account, no server of ours.
- **From source — free, forever** — clone and run it (`bun dev`, or build the
  desktop app yourself with `bun run dist:mac`). Every feature, no license key.
  That's the point of the open-source build.

> The hosted site used to run the editor in the browser (BYOK). It's now the
> product site; if you made projects there, open
> [/export](https://card-news-zeta.vercel.app/export) in the same browser to
> download them, then use ⬆ Import in the app.

- 🧠 **Deep-dive on how it works:** [ARCHITECTURE.md](ARCHITECTURE.md)
- 🛠️ **Want to hack on it or add a model/template/language:** [CONTRIBUTING.md](CONTRIBUTING.md)

---

## Features

- **AI draft generation** — a story, an article or a video in, a themed carousel
  out, streamed slide-by-slide into the editor as the model writes it. Powered by
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
- **Photo sets (reels → carousel)** — add your own photos (HEIC OK locally); the
  AI decides the slide count, copies the reference's photo composition (e.g.
  two photos stacked per slide), places copy off each photo's subject, and asks
  for more photos when it needs them. Paste the reel's script/analytics as
  reference material.
- **Guided create flow** — format reference → video-to-carousel or a new story →
  design → ratio → AI, then refine in the editor's AI chat.
- **Reference posts** — paste a public Instagram, LinkedIn or TikTok post (in
  the create flow or the chat) and every slide (plus captions, per-slide text,
  subtitles and engagement where available) is benchmarked, no login needed.
  If a platform blocks it, drop in screenshots instead.
- **Claude subscription mode (local)** — run on your Claude plan through the
  installed Claude Code CLI instead of an API key.
- **Reference library** — every reference you've used, plus favorites saved
  ahead of time by link.
- **@-mentions** — tag slides and images in the chat from a preview picker.
- **Video → carousel** — paste a YouTube or TikTok link; subtitles are fetched
  (no API key needed) and unfolded into a carousel that quotes the real script.
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

## Desktop app

The desktop app is the local mode, packaged: Electron starts Next's
**standalone server** on `127.0.0.1:3458` and opens a window on it, so
everything local mode does — filesystem projects, the Claude subscription path,
HEIC conversion, the reference scrapers — runs unchanged.

```bash
bun install
bun run desktop:dev   # window on your running `bun dev` (CARDNEWS_DEV_URL, default :3457)
bun run desktop:build # standalone server + electron main/preload → then `bun run desktop`
bun run dist:mac      # unsigned .dmg/.zip in release/ — a free "source" build
```

Needs Node 22 (`.tool-versions`) — Electron's installer requires it. Source
builds show a `source` badge, never lock, and don't auto-update (pull + rebuild).
Official builds come only from the tag-triggered CI workflow
(`.github/workflows/release.yml`). Details: [ARCHITECTURE.md](ARCHITECTURE.md#desktop-app).

## Local-first by design

There is still **no server-side product**: no account, no database, no stored
user data — in any mode.

- **In the desktop app**, projects, the reference library and photos live in
  the app's data folder (`~/Library/Application Support/Card News Studio`),
  API keys are encrypted with the macOS keychain (`safeStorage`), and the only
  outside calls are the AI provider you chose, reference pages you paste,
  license checks (Lemon Squeezy's API, official builds) and update checks
  (GitHub Releases). Settings → Your data opens or erases the folder.

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
[html-to-image](https://github.com/bubkoo/html-to-image) · desktop: Electron 43 + electron-builder + electron-updater. No Tailwind (hand-written
CSS in `app/globals.css`), no test framework — verification is `npm run build`
(typecheck + prod build) plus driving the UI.

## License

[MIT](LICENSE) — free to use, fork, and modify. The source is and stays free:
building it yourself needs no key. The signed, notarized builds sold at
[card-news-zeta.vercel.app](https://card-news-zeta.vercel.app) are distributed
under their own [terms](https://card-news-zeta.vercel.app/terms) (a free period,
then a license key) — the same "VS Code model" as its sibling app ZTO.
