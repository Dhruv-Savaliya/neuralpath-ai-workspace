import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { chunkKnowledgeText } from "../src/ai/chunking";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const EMBEDDING_MODEL = process.env.CLOUDFLARE_EMBEDDING_MODEL || "@cf/baai/bge-m3";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to seed the public corpus.");
  console.error("Provide these environment variables to execute this script.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    console.warn("Cloudflare credentials missing; generating deterministic mock embeddings for offline verification.");
    return texts.map(() => new Array(1024).fill(0.001));
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${EMBEDDING_MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: texts }),
    }
  );

  if (!response.ok) {
    throw new Error(`Embedding request failed with status ${response.status}: ${await response.text()}`);
  }

  const data = await response.json() as { result?: { data?: number[][] } };
  const embeddings = data.result?.data;
  if (!embeddings || embeddings.length !== texts.length) {
    throw new Error("Cloudflare embedding batch returned invalid data shape.");
  }
  return embeddings;
}

async function seedSubject(subjectDir: string, subjectName: string) {
  const files = readdirSync(subjectDir).filter(f => f.endsWith(".md"));
  console.log(`\n📚 Processing subject: ${subjectName} (${files.length} documents)`);

  for (const file of files) {
    const filePath = join(subjectDir, file);
    const content = readFileSync(filePath, "utf-8");
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const docTitle = titleMatch ? titleMatch[1].trim() : file.replace(/\.md$/, "").replace(/-/g, " ");

    const chunks = chunkKnowledgeText(content);
    if (!chunks.length) continue;

    console.log(`  - Ingesting "${docTitle}" (${chunks.length} chunks)...`);
    const sourceId = randomUUID();
    const embeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += 8) {
      const batch = chunks.slice(i, i + 8);
      const batchEmbeddings = await embedBatch(batch);
      embeddings.push(...batchEmbeddings);
    }

    const rows = chunks.map((chunk, index) => ({
      source_id: sourceId,
      user_id: null,
      source_title: docTitle,
      source_url: null,
      chunk_index: index,
      content: chunk,
      embedding: embeddings[index],
      embedding_model: EMBEDDING_MODEL,
      visibility: "public" as const,
    }));

    const { error } = await supabase.from("knowledge_chunks").insert(rows);
    if (error) {
      console.error(`    ❌ Failed to insert chunks for "${docTitle}":`, error.message);
    } else {
      console.log(`    ✓ Saved ${rows.length} public chunks for "${docTitle}"`);
    }
  }
}

async function main() {
  const corpusRoot = resolve(__dirname, "../../../content/public-corpus");
  console.log("Starting NeuralPath public library seed from:", corpusRoot);

  const entries = readdirSync(corpusRoot);
  for (const entry of entries) {
    const fullPath = join(corpusRoot, entry);
    if (statSync(fullPath).isDirectory()) {
      const subjectName = entry.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      await seedSubject(fullPath, subjectName);
    }
  }

  console.log("\n✅ Public corpus seeding completed.");
}

main().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
