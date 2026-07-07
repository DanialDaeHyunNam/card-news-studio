# Contributing

Thanks for hacking on Card News Studio. It's MIT — fork it, lift pieces out of
it, or send a PR. This is the practical guide; for how the system fits together,
read [ARCHITECTURE.md](ARCHITECTURE.md) first.

## Setup & the one rule of verification

```bash
git clone https://github.com/DanialDaeHyunNam/card-news-studio.git
cd card-news-studio
npm install        # or bun install
npm run dev        # http://localhost:3000
```

There is **no test framework.** Verification is:

```bash
npm run build      # typecheck + production build — run after EVERY change
```

`bun run build` must stay green, and then you drive the actual UI to confirm
behavior. A change that typechecks but you haven't exercised in the browser is
not done.

To exercise the AI paths you need at least one provider key — paste it in the
🔑 panel (writes `.env.local`) or `cp .env.example .env.local` and fill it in.

## Conventions

- **TypeScript, strict.** No `any` sneaking through; model the data in `types.ts`.
- **No Tailwind.** All styles live in `app/globals.css`, using the CSS variables
  at the top (`--bg`, `--panel`, `--border`, `--accent`, …). Match the existing
  dark, pill-shaped, bold-typography look.
- **Bilingual or it's a regression.** Every user-facing string goes through
  `useLang()`'s `t()` with a `[ko, en]` entry in `lib/i18n.tsx`. Two languages
  only — don't add a third.
- **Keep `CardView` the single renderer.** If you change how a card looks, change
  it there so canvas, thumbnails, and export stay identical.
- **Comment the *why*, not the *what*.** Match the density of the surrounding code.
- **No secrets in the repo.** Keys live in `.env.local` (gitignored) only.

## Common recipes

### Add an AI model

One line in `lib/models.ts` — append a `ModelInfo` to `MODELS` (`id`, `provider`,
`envVar`, `short`, `label`, pricing, speed). If it's a new **provider**, also add
its `envVar` to `.env.example` and wire an adapter branch in `lib/ai.ts` (or reuse
the OpenAI adapter if the provider has an OpenAI-compatible endpoint, as Gemini
does). The model appears in `ModelPicker` automatically.

### Add a template

Append to `lib/templates.ts`. Templates are **layout-inspired only** — write
**original** copy and accent colors so nothing traces back to a real creator's
content. All templates use the photo + tinted-dim-overlay background style. Bundle
any photo under `public/templates/`. Provide both `ko` and `en` copy.

### Add a language string

Add a `key: [ko, en]` pair to the `D` dictionary in `lib/i18n.tsx` and use
`t("key")`. Don't hardcode display text in components.

### Add a curated background photo

Add an entry to `lib/photos.ts` — but **look at the image first** (grid HTML +
headless screenshot is the fast way) and tag it honestly in both languages. The
AI picks from these tags; wrong tags produce wrong backgrounds. Never guess IDs.

### Change the element model

Touch these together or things drift: `lib/types.ts` → `lib/schemas.ts` →
`lib/prompts.ts` → `lib/ops.ts` (normalize/patch) → `components/CardView.tsx`
(render).

## Deploying the showcase

The public site is a **showcase + install guide**, not a working instance (see
[ARCHITECTURE.md → Hosted vs. local mode](ARCHITECTURE.md#hosted-vs-local-mode)).
On Vercel it activates automatically via `VERCEL=1`. **Deploy from the project
folder only** — never a parent directory that might contain other projects or
private data. Preview the hosted behavior locally with `HOSTED_DEMO=1 bun dev`.

## Pull requests

- Keep PRs focused; describe the change and how you verified it in the browser.
- Confirm `npm run build` passes.
- New user-facing strings: bilingual. New types: model the invariants.
- Be kind. This is a small open-source project built in public.
