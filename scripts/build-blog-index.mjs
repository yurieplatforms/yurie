// scripts/build-blog-index.mjs
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Settings ---
const POSTS_DIR = path.join(process.cwd(), "app", "blog", "posts");
const OUT_FILE = path.join(process.cwd(), "app", "blog", "rag.index.json");
const BASE_URL = process.env.BLOG_BASE_URL || "https://yurieblog.vercel.app"; // matches app/sitemap.ts
const MODEL = "text-embedding-3-small"; // inexpensive & plenty good

// --- Helpers (matches your app/blog/utils.ts approach) ---
function parseFrontmatter(fileContent) {
  const frontmatterRegex = /---\s*([\s\S]*?)\s*---/;
  const match = frontmatterRegex.exec(fileContent);
  if (!match) return { metadata: {}, content: fileContent.trim() };
  const frontMatterBlock = match[1];
  const content = fileContent.replace(frontmatterRegex, "").trim();
  const metadata = {};
  for (const line of frontMatterBlock.trim().split("\n")) {
    const [key, ...rest] = line.split(": ");
    const val = rest.join(": ").trim().replace(/^['"](.*)['"]$/, "$1");
    metadata[key.trim()] = val;
  }
  return { metadata, content };
}

function chunk(text, size = 1200, overlap = 200) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = i + size;
    const slice = text.slice(i, end);
    chunks.push(slice);
    if (end >= text.length) break;
    i = end - overlap;
  }
  return chunks;
}

async function main() {
  // Check if OPENAI_API_KEY is available
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("OPENAI_API_KEY not found. Creating fallback blog index without embeddings.");
    await createFallbackIndex();
    return;
  }

  const client = new OpenAI({ apiKey });
  const files = (await fs.readdir(POSTS_DIR)).filter(f => f.endsWith(".mdx"));

  const docs = [];
  for (const filename of files) {
    const full = path.join(POSTS_DIR, filename);
    const raw = await fs.readFile(full, "utf8");
    const { metadata, content } = parseFrontmatter(raw);
    const slug = path.basename(filename, path.extname(filename));
    const title = metadata.title || slug;
    const url = `${BASE_URL}/blog/${slug}`;

    const chunks = chunk(content);
    for (let i = 0; i < chunks.length; i++) {
      docs.push({
        id: `${slug}-${i}`,
        slug,
        title,
        url,
        chunk: chunks[i],
      });
    }
  }

  // Batch embed all chunks (OpenAI handles batching internally)
  const emb = await client.embeddings.create({
    model: MODEL,
    input: docs.map(d => d.chunk),
  });

  for (let i = 0; i < docs.length; i++) {
    docs[i].embedding = emb.data[i].embedding;
  }

  const out = {
    model: MODEL,
    base_url: BASE_URL,
    built_at: new Date().toISOString(),
    docs,
  };

  await fs.writeFile(OUT_FILE, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote ${docs.length} chunks → ${OUT_FILE}`);
}

async function createFallbackIndex() {
  const files = (await fs.readdir(POSTS_DIR)).filter(f => f.endsWith(".mdx"));

  const docs = [];
  for (const filename of files) {
    const full = path.join(POSTS_DIR, filename);
    const raw = await fs.readFile(full, "utf8");
    const { metadata, content } = parseFrontmatter(raw);
    const slug = path.basename(filename, path.extname(filename));
    const title = metadata.title || slug;
    const url = `${BASE_URL}/blog/${slug}`;

    const chunks = chunk(content);
    for (let i = 0; i < chunks.length; i++) {
      docs.push({
        id: `${slug}-${i}`,
        slug,
        title,
        url,
        chunk: chunks[i],
        embedding: new Array(1536).fill(0), // Dummy embedding for text-embedding-3-small
      });
    }
  }

  const out = {
    model: MODEL,
    base_url: BASE_URL,
    built_at: new Date().toISOString(),
    docs,
  };

  await fs.writeFile(OUT_FILE, JSON.stringify(out, null, 2), "utf8");
  console.log(`Created fallback index with ${docs.length} chunks (no embeddings) → ${OUT_FILE}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
