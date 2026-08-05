import { env } from "@/lib/env";

export interface TranscribeResult {
  transcript: string;
  wordsPerMinute?: number;
  pauseCount: number;
  avgPauseSec?: number;
  fillerWordCount: number;
  fillerDensity: number;
  fluencyScore: number;
  durationSec?: number;
  source: "faster_whisper" | "web_speech";
}

export interface SemanticScoreResult {
  cosine: number;
  semanticScore: number;
}

/**
 * HTTP client for the self-hosted pythonai FastAPI service.
 * All calls time out and degrade gracefully: interview flow never blocks on a
 * missing analysis service.
 */
export class PythonAiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = env.pythonaiUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async transcribe(audio: Blob, timeoutMs?: number): Promise<TranscribeResult> {
    const form = new FormData();
    form.append("audio", audio, "answer.wav");

    const response = await this.fetch("/transcribe", {
      method: "POST",
      body: form,
      timeoutMs: timeoutMs ?? env.pythonaiTimeoutMs,
    });

    if (!response.ok) {
      throw new Error(`pythonai transcription failed (${response.status})`);
    }

    const data = (await response.json()) as {
      transcript?: string;
      words_per_minute?: number;
      pause_count?: number;
      avg_pause_sec?: number;
      filler_word_count?: number;
      filler_density?: number;
      fluency_score?: number;
      duration_sec?: number;
      source?: string;
    };

    return {
      transcript: data.transcript ?? "",
      wordsPerMinute: data.words_per_minute,
      pauseCount: data.pause_count ?? 0,
      avgPauseSec: data.avg_pause_sec,
      fillerWordCount: data.filler_word_count ?? 0,
      fillerDensity: data.filler_density ?? 0,
      fluencyScore: data.fluency_score ?? 0,
      durationSec: data.duration_sec,
      source: data.source === "faster_whisper" ? "faster_whisper" : "web_speech",
    };
  }

  async semanticScore(params: {
    question: string;
    answer: string;
    role?: string;
    resumeContext?: string;
  }): Promise<SemanticScoreResult> {
    const response = await this.fetch("/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: params.question,
        answer: params.answer,
        role: params.role,
        resume_context: params.resumeContext,
      }),
      timeoutMs: 30_000,
    });

    if (!response.ok) {
      throw new Error(`pythonai embeddings failed (${response.status})`);
    }

    const data = (await response.json()) as {
      cosine?: number;
      semantic_score?: number;
    };
    return {
      cosine: data.cosine ?? 0,
      semanticScore: data.semantic_score ?? data.cosine ?? 0,
    };
  }

  async ping(): Promise<boolean> {
    try {
      const response = await this.fetch("/health", { timeoutMs: 5_000 });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async fetch(
    path: string,
    init: RequestInit & { timeoutMs?: number },
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 30_000);
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

export const pythonai = new PythonAiClient();
