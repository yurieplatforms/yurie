// app/lib/blog-rag.ts
import fs from "fs";
import path from "path";
import OpenAI from "openai";

type Doc = {
  id: string;
  slug: string;
  title: string;
  url: string;
  chunk: string;
  embedding: number[];
};

type Index = {
  model: string;
  base_url: string;
  built_at: string;
  docs: Doc[];
};

let cached: Index | null = null;

export function loadBlogIndex(): Index | null {
  if (cached) return cached;
  try {
    const p = path.join(process.cwd(), "app", "blog", "rag.index.json");
    const raw = fs.readFileSync(p, "utf8");
    cached = JSON.parse(raw);
    return cached;
  } catch {
    return null;
  }
}

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

export async function searchBlog(
  client: OpenAI,
  query: string,
  k = 6
): Promise<(Doc & { score: number })[]> {
  const idx = loadBlogIndex();
  if (!idx || !query || !query.trim()) return [];
  const emb = await client.embeddings.create({
    model: idx.model || "text-embedding-3-small",
    input: query,
  });
  const q = emb.data[0].embedding;
  return [...idx.docs]
    .map(d => ({ ...d, score: cosine(q, d.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
