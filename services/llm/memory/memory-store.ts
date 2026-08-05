import { createEmbeddingProvider } from "@/services/llm/provider";

/**
 * Lightweight semantic memory for interview context.
 *
 * Instead of resending the entire transcript every turn (which grows without
 * bound and costs tokens), we store extracted facts per answer, embed them once,
 * and retrieve the most relevant facts for the next question. This keeps the
 * context window bounded while preserving long-range recall.
 */

export interface MemoryFact {
  id: string;
  content: string;
  createdAt: number;
}

export interface MemoryQuery {
  embedding: number[];
}

export interface MemoryStore {
  add(fact: MemoryFact): Promise<void>;
  search(query: MemoryQuery, limit?: number): Promise<Array<{ fact: MemoryFact; score: number }>>;
  list(): MemoryFact[];
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * In-memory semantic memory. Facts are embedded on add (via Ollama embeddings)
 * and retrieved by cosine similarity. For horizontal scaling, persist facts in
 * Postgres (or Redis) and embed on retrieval — the interface is unchanged.
 */
export class SemanticMemoryStore implements MemoryStore {
  private readonly facts = new Map<string, MemoryFact>();
  private readonly embeddings = new Map<string, number[]>();
  private readonly embedder = createEmbeddingProvider();

  async add(fact: MemoryFact): Promise<void> {
    this.facts.set(fact.id, fact);
    try {
      const { embedding } = await this.embedder.embed(fact.content);
      this.embeddings.set(fact.id, embedding);
    } catch {
      // Embedding failure degrades to no-search memory; the raw facts remain.
      this.embeddings.delete(fact.id);
    }
  }

  async search(
    query: MemoryQuery,
    limit = 3,
  ): Promise<Array<{ fact: MemoryFact; score: number }>> {
    const results: Array<{ fact: MemoryFact; score: number }> = [];
    for (const [id, embedding] of this.embeddings) {
      const fact = this.facts.get(id);
      if (!fact) continue;
      results.push({ fact, score: cosineSimilarity(query.embedding, embedding) });
    }
    return results
      .filter((r) => r.score > 0.35)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  list(): MemoryFact[] {
    return [...this.facts.values()].sort(
      (a, b) => a.createdAt - b.createdAt,
    );
  }
}

/**
 * Extracts terse memory facts from a candidate answer. Kept heuristic and cheap:
 * a structured local extraction rather than a paid parse.
 */
export function extractMemoryFacts(answer: string, index: number): MemoryFact[] {
  const clean = answer.trim();
  if (!clean) return [];

  const facts: MemoryFact[] = [];

  const experienceMatch = clean.match(
    /(\d+)\s*(?:\+)?\s*years?(\s*of)?\s*experience/i,
  );
  if (experienceMatch) {
    facts.push({
      id: `exp-${index}`,
      content: `Candidate has ${experienceMatch[1]} years of experience.`,
      createdAt: Date.now(),
    });
  }

  const sentenceCandidates = clean
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length >= 20 && s.length <= 220);

  for (let i = 0; i < sentenceCandidates.length && facts.length < 4; i++) {
    const sentence = sentenceCandidates[i];
    const isSelfReference = /^(i|i've|i am|i was|i have|my|we|our)\b/i.test(sentence);
    if (isSelfReference) {
      facts.push({
        id: `fact-${index}-${i}`,
        content: sentence,
        createdAt: Date.now(),
      });
    }
  }

  return facts;
}
