# Yurie Blog

A minimalist portfolio + blog built with Next.js App Router and Tailwind v4, now with an OpenAI‑powered chat playground.

## Features

- MDX and Markdown posts with syntax highlighting
- SEO: sitemap, robots, JSON‑LD schema
- Dynamic OG images
- Tailwind v4, Geist font, Vercel Speed Insights / Analytics
- Chat playground at `/playground` with streaming text responses and optional inline images
  - Defaults: size=auto, quality=high, background=auto, format=png, partial_images=3, input_fidelity=high, moderation=auto
  - Streaming partial frames (0-3), revised prompt + response ID metadata
  - Attach images for analysis or edits; mask-based edits supported when a mask is provided
- Reusable model selector component (`app/components/model-selector.tsx`)

## Quickstart

Prerequisites: Node 18+ and [pnpm](https://pnpm.io/installation).

1) Install dependencies

```bash
pnpm install
```

2) Configure environment variables

Create a `.env` file in the project root:

```bash
OPENAI_API_KEY=your_openai_key
# Optional: enable web search tool on server by default
ENABLE_WEB_SEARCH=true
# Optional: enable web search toggle default in client UI
NEXT_PUBLIC_ENABLE_WEB_SEARCH=true
```

3) Run the dev server

```bash
pnpm dev
```

Open the printed URL (typically `http://localhost:3000`) and visit `/playground`.

## Scripts

- `pnpm dev`: Start Next.js in development
- `pnpm build`: Build for production
- `pnpm start`: Start the production server

## Playground API

- Endpoint: `POST /api/playground`
- Request body:

```json
{
  "messages": [{ "role": "user", "content": "Hello" }],
  "model": "gpt-5" // optional, defaults to gpt-5
}
```

- The server streams plain text tokens (`text/plain`) in the response body.
- When an image is generated, the stream includes a data URL sentinel like:

  ```
  <image:data:image/png;base64,BASE64_DATA>
  ```

  Your client can detect these tokens and render the image inline.

See `app/api/playground/route.ts`.

### Images and vision (analyze or edit)

- By default, image requests use the Responses API image_generation tool with streaming.
- When images are attached and you ask to analyze, the server uses vision to describe or answer questions.
- When a mask is attached, the server auto-routes to the Image API for inpainting-style edits (first attached image is edited by the mask).
- Server defaults (no options UI): size=auto, quality=high, background=auto, format=png, partial_images=3, input_fidelity=high, moderation=auto
- The stream includes tokens:
  - `<image_partial:data:image/...>` for partial frames
  - `<image:data:image/...>` for final image
  - `<revised_prompt:...>` with the revised prompt
  - `<response_id:...>` to allow multi-turn follow-ups

### Web search

- Web search is enabled via a toggle in the `/playground` UI.
- When enabled, the server uses the GA `web_search` tool and will always:
  - Include sources (appended as a “Sources” section at the end of responses)
  - Use high search context size for richer results
- Optional env flags:
  - `ENABLE_WEB_SEARCH=true` to enable by default on the server
  - `NEXT_PUBLIC_ENABLE_WEB_SEARCH=true` to show the toggle as on in the client

Notes:
- Inline citations in the model output are preserved; the UI appends a Sources list based on citations and tool-returned sources.

## Customization

- Posts live in `app/blog/posts/*.mdx`
- Blog routes are in `app/blog/*`
- Playground UI is in `app/playground/page.tsx` and `app/playground/ChatClient.tsx`

## Deployment

Deploy to [Vercel](https://vercel.com/). Set `OPENAI_API_KEY` in your project’s Environment Variables.

