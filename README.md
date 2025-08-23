# Yurie Blog

A minimalist portfolio + blog built with Next.js App Router and Tailwind v4, now with an OpenAI‑powered chat playground.

## Features

- MDX and Markdown posts with syntax highlighting
- SEO: sitemap, robots, JSON‑LD schema
- Dynamic OG images
- Tailwind v4, Geist font, Vercel Speed Insights / Analytics
- Chat playground at `/playground` with streaming text responses and optional inline images
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

### Model selector

The chat page uses a reusable selector in `app/components/model-selector.tsx`.

- Update available options by editing `DEFAULT_OPTIONS`
- Styling notes:
  - Arrow is hidden via `appearance-none`
  - Height matches inputs/buttons via `h-10`

## Customization

- Posts live in `app/blog/posts/*.mdx`
- Blog routes are in `app/blog/*`
- Playground UI is in `app/playground/page.tsx` and `app/playground/ChatClient.tsx`

## Deployment

Deploy to [Vercel](https://vercel.com/). Set `OPENAI_API_KEY` in your project’s Environment Variables.

