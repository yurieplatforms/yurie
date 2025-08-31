# Yurie Blog

A minimalist portfolio + blog built with Next.js App Router and Tailwind v4, now with an OpenAI‑powered chat playground.

## Features

- MDX and Markdown posts with syntax highlighting
- SEO: sitemap, robots, JSON‑LD schema
- Dynamic OG images
- Tailwind v4, Geist font, Vercel Speed Insights / Analytics
- Chat playground at `/playground` with streaming responses and image tools
  - Attach image(s) to analyze or provide reference context
  - Image generation is triggered automatically based on your prompt or attached images
  - Defaults: size=auto, quality=high, background=auto, format=png, partial_images=3, input_fidelity=high, moderation=auto
  - Streaming partial frames (0-3), revised prompt + response ID metadata
  - Mask-based edits are supported by the API, but the UI does not include a mask upload control
  - Clicking “playground” in the navbar while on `/playground` refreshes the page to reset chat
  

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
# Optional: restrict web search to specific domains (comma‑separated)
WEB_SEARCH_ALLOWED_DOMAINS=example.com,another.example
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
  "messages": [{ "role": "user", "content": "Hello" }]
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

- The UI streams image generation automatically when your prompt implies image creation or when images are provided.
- When images are attached and you ask to analyze, the server uses vision to describe or answer questions.
- The API supports mask-based edits when a mask is provided; the default UI does not include a mask uploader.
- Server defaults (no options UI): size=auto, quality=high, background=auto, format=png, partial_images=3, input_fidelity=high, moderation=auto
- The stream includes tokens:
  - `<image_partial:data:image/...>` for partial frames
  - `<image:data:image/...>` for final image
  - `<revised_prompt:...>` with the revised prompt
  - `<response_id:...>` to allow multi-turn follow-ups

### Web search

- The server may use the GA `web_search` tool automatically for non‑image prompts and will:
  - Include sources (appended as a “Sources” section at the end of responses)
  - Use high search context size for richer results
- Web search always uses high context with no domain/location restrictions.

## Customization

- Posts live in `app/blog/posts/*.mdx`
- Blog routes are in `app/blog/*`
- Playground UI is in `app/playground/page.tsx` and `app/playground/ChatClient.tsx`

## Deployment

Deploy to [Vercel](https://vercel.com/). Set `OPENAI_API_KEY` in your project’s Environment Variables.

