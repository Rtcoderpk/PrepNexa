import { createEmbeddingProvider } from "@/services/llm/provider";
import { SemanticMemoryStore } from "@/services/llm/memory/memory-store";

/**
 * Higher-level semantic memory facade: remembers previous answers and surfaces
 * them as compact context for the next question so Alex never repeats a topic
 * and can reference prior answers naturally.
 */

const memoryStore = new SemanticMemoryStore();
const embedder = createEmbeddingProvider();

let factCounter = 0;

export async function rememberAnswer(answer: string): Promise<void> {
  const clean = answer.trim();
  if (!clean) return;

  // Store the answer itself plus terse extracted facts for retrieval.
  const now = Date.now();
  await memoryStore.add({
    id: `answer-${++factCounter}`,
    content: clean.slice(0, 800),
    createdAt: now,
  });
}

export async function recallMemory(query: string): Promise<string> {
  try {
    const { embedding } = await embedder.embed(query);
    const hits = await memoryStore.search({ embedding }, 3);
    if (hits.length === 0) return "";
    return hits
      .map((h) => h.fact.content)
      .join("\n")
      .slice(0, 2000);
  } catch {
    return "";
  }
}

/** All remembered facts, oldest first (used for the question-bank guard). */
export function listMemoryFacts(): string[] {
  return memoryStore.list().map((f) => f.content);
}
