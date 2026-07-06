# Card News Studio

AI-powered card news maker for social media. Type a topic, get a full carousel
drafted by Claude — then refine it on a Figma-like canvas and export PNGs.

카드뉴스 제작 툴입니다. 주제를 입력하면 Claude가 카피와 레이아웃을 설계하고,
캔버스에서 자유롭게 다듬은 뒤 PNG로 내보낼 수 있습니다.

## Features

- **AI draft generation** — topic/article in, a themed card set out (hook → body → CTA), powered by Claude structured outputs
- **Canvas editor** — drag anything anywhere, with Figma-style smart guides (snap to other elements' edges/centers and the card center)
- **Inline editing** — double-click text to edit in place; full control of font size, weight, color, alignment, line height
- **AI chat editing (multimodal)** — select a card or element and ask for changes in natural language; paste or drop images into chat and ask to place them ("원본 그대로 넣어줘")
- **Style continuity** — start a new set that inherits the theme and tone of a previous project
- **Formats** — 1:1 (1080×1080), 4:5 (1080×1350), 9:16 (1080×1920), chosen per project
- **PNG export** — per card or the whole set, at full resolution
- **No server state** — everything lives in your browser's localStorage; API keys never reach the client

## Getting started

```bash
bun install            # or npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
bun dev                # http://localhost:3000
```

Requires an [Anthropic API key](https://platform.claude.com/). The key is read
server-side only (route handlers proxy all model calls).

## How it works

- `app/api/generate` — topic → `{theme, cards[]}` via Claude (`claude-opus-4-8`) with a JSON schema-constrained response
- `app/api/chat` — project JSON + selection + chat (with image attachments) → `{reply, operations[]}`; operations are a small edit language (`update_element`, `add_card`, …) applied client-side in `lib/ops.ts`
- Attached images are sent to the model resized; when the AI places one on a card it references `attachment:N` and the client substitutes the full-resolution original
- Coordinates are percent-based; `fontSize`/`radius` are px at 1080-wide export scale, so cards render identically in thumbnails, canvas, and export

## Stack

Next.js 16 · React 19 · TypeScript · [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) · html-to-image

## License

[MIT](LICENSE)
