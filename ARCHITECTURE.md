# Architecture

Everything you need to understand Card News Studio deeply enough to change it,
extend it, or lift a piece of it into your own project. For the practical
"how do I add X" recipes, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Big picture

Card News Studio is a **single-page client app** with a handful of thin route
handlers. There is **no remote server state and no database** — persistent data
lives on *your* machine, as plain files.

```
Browser (all the real work)                    Server (thin proxies + local files)
┌──────────────────────────────┐               ┌──────────────────────────────┐
│ React state: editor, canvas   │               │ app/api/generate  ─ AI draft │
│ lib/ops, lib/stream, CardView │  ── fetch ──▶ │ app/api/chat      ─ AI edits │
│ html-to-image export          │  ◀─ SSE ───   │ app/api/youtube   ─ captions │
│                               │               │ app/api/photo     ─ img proxy│
│                               │               │ app/api/keys      ─ .env r/w │
│                               │               │ app/api/projects  ─ data/ r/w│
└──────────────────────────────┘               └──────────────────────────────┘
        no upload of your data                   the API key never reaches client
```

The AI route handlers exist for exactly one reason: **the provider API key must
never reach the browser.** Model calls are proxied server-side; the browser only
ever receives model *output*. Nothing is uploaded anywhere.

**Storage** (`lib/store.ts`): on local dev, projects are plain JSON files —
`data/projects/<id>.json`, written through the dev-only `/api/projects` route
(deletes are soft: files move to `data/trash/`). That means no localStorage
quota, no origin/port coupling, and `data/` + `public/uploads/` together are a
complete backup. Where the dev route can't run (the hosted showcase, a prod
build), the store transparently falls back to `localStorage`
(`cardnews.projects.v1`), and a legacy localStorage library is migrated to files
once, on the first filesystem load. Saves are debounced (300ms) and the route
rewrites only files whose content changed. For moving work between machines,
`lib/transfer.ts` exports a project as a self-contained `.cardnews.json`
(every `/uploads/` image inlined as a data URL) and re-files those images
through `/api/asset` on import.

`app/page.tsx` returns `null` on the server and until the store loads on the
client — SSR HTML is intentionally empty. This means the app is effectively fully
client-rendered, which is why there's no hydration-mismatch risk for UI derived
from the store or the `data-hosted` flag.

## Data model (`lib/types.ts`)

```
Project ─┬─ format: "1:1" | "4:5" | "9:16"
         ├─ theme:  { background, textColor, accent, fontFamily }
         ├─ cards[] ─┬─ background: CSS color | gradient (may embed a photo URL)
         │           └─ elements[] : TextElement | ShapeElement | ImageElement
         ├─ chat[]  : ChatMessage[]   (assistant turns carry `ops` count)
         ├─ model?  : lib/models.ts id
         ├─ usage?  : cumulative token/cost totals
         └─ ignoreBrand?, createdAt, updatedAt
```

Two coordinate conventions, and getting them right is the key to the whole thing:

- **Position/size** (`x`, `y`, `w`) are **percent of the card** (0–100). This is
  what makes one layout render identically at any pixel size.
- **`fontSize` / `radius`** are **pixels at the 1080-wide export scale.** At any
  other render width they're scaled by `width / 1080`.

Because of this, **one renderer serves everything** — canvas, thumbnails, and the
off-screen export node are all `components/CardView.tsx`. Keep it the single
source of truth; if a card looks right on the canvas it will export identically.

## The AI pipeline

### Model registry (`lib/models.ts`)

Every model is one entry in the `MODELS` array: `id`, `provider`, `envVar`,
display `short`/`label`, pricing, and speed. Adding a model is a one-line append.
Helpers: `resolveModel`, `pickDefaultModel(keys)` (best-value default for a
connected provider), `KEY_ENV_VARS`, `PROVIDER_LABELS`, `priceLabel`.

### Dispatcher (`lib/ai.ts`)

`streamResponse(opts)` returns a `Response` that streams Server-Sent Events. It
branches by provider behind one interface:

- **Anthropic** — official `@anthropic-ai/sdk`, streaming, structured outputs.
- **OpenAI** — chat/completions with `response_format: json_object` and the JSON
  schema embedded in the system prompt (strict `json_schema` fights optional
  fields; our normalizers tolerate loose JSON instead). Vision via `image_url`
  data URLs. Note GPT-5.x requires `max_completion_tokens`, not `max_tokens`.
- **Gemini** — reuses the OpenAI adapter against Google's OpenAI-compatible
  endpoint.

Each call emits a `usage` event (tokens + cost; Anthropic cache multipliers and
OpenAI cached-input pricing are accounted for) which accumulates into
`project.usage` (`lib/usage.ts`) — the ⚡ chip in the editor topbar.

The wire format is a small `StreamEvent` union: `delta` (text chunk), `done`
(final text + usage), `error`.

### Client partial-JSON parser (`lib/stream.ts`) — the crux

Streaming *structured* output robustly is done **on the client, not the server.**
A string-aware brace walker consumes the growing text so that:

- during streaming, `extractCards` / `extractReply` pull a usable partial view
  (render cards 0 → 1 → 2 as they close), and
- at the end, `parseStructured` extracts the **first complete** JSON object.

Using the same walker for live rendering and final parsing is what kills the
classic "Unexpected non-whitespace after JSON" bug that weak models and
OpenAI-compat endpoints produce (trailing prose, duplicate objects). `readSSE`
is the async-iterator client for the SSE stream.

### Generation flow (`app/api/generate` + `app/page.tsx`)

1. `Home` collects a `GenConfig` (topic, format, count, model, accent, reference).
2. `Root.startGenerate` opens the editor on an empty **draft** project
   immediately (instant transition), then streams.
3. For each SSE `delta`, it appends only **newly-closed** cards, keeping existing
   card ids stable so entrance animations don't re-mount.
4. On `done`, `parseStructured` produces the final `{theme, cards}`, which is
   normalized and persisted.

### Chat flow (`app/api/chat` + `components/ChatPanel.tsx`)

Sends sanitized project JSON (image `src`s stripped), the current selection, chat
history, and any image attachments → `{reply, operations[]}`.

**Operations** are the edit language the AI speaks (`lib/ops.ts`,
`applyOperations`): `update_element`, `add_element`, `remove_element`,
`reorder_element`, `update_card`, `add_card`, `remove_card`, `update_theme`.
`applyOperations` is pure — it clamps numbers and skips unknown ids, so a
malformed op degrades instead of throwing.

**Attachment protocol:** chat images are sent to the model resized (≤1200px). The
AI inserts one with `src: "attachment:N"`, and `applyOperations` substitutes the
full image, saved to `public/uploads/` via `/api/asset` and referenced by its
short URL. Chat history persists only tiny display thumbnails.

**Z-order:** `CardView` renders `elements` in array order (last = on top; there's
no `z-index`). `reorder_element` moves an element by target `index` (0 = back);
`add_element` accepts an `index`. This is why an AI-added image can be sent behind
the text instead of covering it.

## Supporting pipelines

- **YouTube (`app/api/youtube`)** — captions **without an API key** via the
  InnerTube player API using the **ANDROID client**. (Watch-page `timedtext` URLs
  return empty bodies without a proof-of-origin token; the WEB client returns no
  tracks — verified 2026-07.) Response may be json3 or timedtext XML; `parseCaptions`
  handles both. The Home hero detects YouTube URLs and runs caption-fetch → generate.
- **Photos (`lib/photos.ts` + `app/api/photo`)** — the AI picks from a **curated**
  free-photo library (IDs + bilingual tags injected into the prompt via
  `photoLibraryPrompt`). `/api/photo` is a same-origin proxy for Lorem Picsum so
  AI-picked backgrounds survive `html-to-image` export (no CORS). Tags were written
  by *looking at* each photo — never guess IDs/tags when adding entries.
- **Smart guides (`lib/snap.ts`)** — on drag, element edges/centers snap to other
  elements' measured DOM rects (percent-space) and card 0/50/100, threshold 6px.
- **Undo (`components/Editor.tsx`)** — snapshot stack (`historyRef`, cap 60). Every
  mutation goes through `mutate()`; push a snapshot before each discrete gesture
  (drag start, inspector focus, chat apply), not per keystroke.
- **Export** — an off-screen `CardView` at 1080px + `html-to-image` `toPng`
  (`skipFonts: true`, system font stack only).
- **Brand color** — a pinned `accent` is a design token: changing it recolors
  every element that used the old value (`normHex` normalization). Persisted in
  localStorage; a per-set "Ignore" flag (`project.ignoreBrand`) detaches one set.
- **Layout consistency** — prompts steer a "block vertical grid" (group elements
  into blocks with uniform spacing and a shared anchor; no `space-between`). Card
  numbers (`n`) are injected so "make 3,4,5 like 1,2" resolves to the right cards.

## i18n (`lib/i18n.tsx`)

A flat `[ko, en]` dictionary + `LangProvider` (localStorage `cardnews.lang`,
defaults from `navigator.language`). `useLang()` → `{ lang, setLang, t }`. There
are **only two languages by design.** Template copy is localized separately in
`lib/templates.ts` (`getTemplates(lang)`, hand-written per language, *not*
machine-translated), and `lang` is sent to the AI routes so generated copy
matches the UI. Server-side error strings are Korean-first.

## Keys (`app/api/keys`)

`GET` returns which provider keys are present (**booleans only** — values never
leave the server) and whether this deployment can write them (`writable`, dev
only). `POST` (local dev only) writes the key into `.env.local` **and** the
running `process.env`, so it applies without a restart. `KeyPanel` degrades
gracefully in production (`writable: false` hides the inputs and shows a hint).

## Hosted vs. local mode

Since v0.8.0 the hosted deploy **runs for real** — it just runs *differently*.
`app/layout.tsx` (a server component) computes
`HOSTED = process.env.VERCEL === "1" || process.env.HOSTED_DEMO === "1"` at
render time and stamps `<html data-hosted="1">`. Because `/` is statically
prerendered, this is evaluated **at build time** — which is exactly right on
Vercel (it sets `VERCEL=1` during the build). `useHosted()` (`lib/hooks.ts`)
reads that attribute in a lazy initializer, so the client knows on its first
render (no flash); `isHostedRuntime()` (`lib/ai-transport.ts`) is the same
signal for non-React code.

|  | local | hosted |
| --- | --- | --- |
| Projects | files in `data/projects/` | `localStorage` (store falls back automatically) |
| API keys | `.env.local` (via `/api/keys`) | browser storage — `lib/client-keys.ts` (sessionStorage by default, localStorage on "remember") |
| AI calls | `/api/generate` etc. → `lib/ai.ts` server dispatch | **browser → provider, directly** — `lib/ai-transport.ts` builds the identical request via `lib/requests.ts` and streams it with `lib/ai-client.ts` (raw fetch SSE; Anthropic uses the official `anthropic-dangerous-direct-browser-access` header) |

The split is glued by three invariants:

- **One prompt source.** `lib/requests.ts` holds the pure request builders;
  the API routes and the hosted browser path both call them, so the two modes
  can never drift.
- **One OpenAI-compat adapter.** `lib/ai-compat.ts` is isomorphic — the server
  calls it with the `.env.local` key, the browser with the user's key.
- **The disclaimer is a contract.** The key panel states that keys live only in
  this browser and travel only to the provider's domain. `next.config.ts` ships
  a Content-Security-Policy that *enforces* it: `connect-src` allows only
  ourselves + the three provider domains, `script-src` allows no external hosts
  (which is also why analytics is limited to Vercel's same-origin script).

Hosted UX: a two-track bar (local install as the primary CTA + a
`DiffModal.tsx` honest comparison), the bilingual `InstallGuide.tsx`, a
dismiss-forever "browser mode" pill in the editor, `/privacy`, and an
"erase all data" footer action (`lib/wipe.ts`). YouTube caption fetching and
the photo/frame proxies still ride our routes on hosted — they carry no key
and no personal data.

Preview it locally with `HOSTED_DEMO=1 bun dev`. **Deploy from this folder only**
(`vercel deploy --prod` inside `card-news/`), never from a parent directory.

## File map

```
app/
  layout.tsx            root; stamps data-hosted
  page.tsx              Root: state, generation orchestration, Home ⇄ Editor
  globals.css           all styles (no Tailwind)
  api/
    generate/route.ts   topic → {theme, cards} (SSE)
    chat/route.ts       project + message → {reply, operations} (SSE)
    youtube/route.ts    URL → captions (InnerTube ANDROID)
    photo/route.ts      same-origin Lorem Picsum proxy
    keys/route.ts       GET presence booleans · POST dev-only .env.local write
components/
  Home.tsx              landing: hero, templates, projects, hosted intercepts
  Editor.tsx            canvas, drag, undo, topbar, export
  CardView.tsx          THE renderer (canvas + thumbs + export)
  ChatPanel.tsx         AI edit chat
  Inspector.tsx         element/theme properties, layer controls
  ModelPicker.tsx       provider-grouped model dropdown
  KeyPanel.tsx          in-app key entry
  InstallGuide.tsx      hosted-mode local-install guide
  Slideshow.tsx, Footer.tsx, HowItWorks.tsx, LangSwitch.tsx, LogoMark.tsx
lib/
  types.ts models.ts schemas.ts prompts.ts   data + AI contracts
  ai.ts stream.ts ops.ts                      dispatch, parse, apply
  templates.ts photos.ts i18n.tsx             content + localization
  snap.ts store.ts usage.ts image.ts site.ts hooks.ts
```
