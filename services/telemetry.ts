import { createClient } from "@/lib/supabase/server";
import {
  clampSpeech,
  clampVision,
  type SpeechMetricsData,
  type VisionMetricsData,
} from "@/lib/validations";

/**
 * Persists per-answer speech + vision metrics against the question that was
 * just answered. Exactly one speech_metrics and one vision_metrics row per
 * answered question (question_id is unique in both tables, so existing rows
 * are replaced on re-answer via upsert).
 */
export async function persistAnswerTelemetry(params: {
  questionId: string;
  speech?: SpeechMetricsData;
  vision?: VisionMetricsData;
}): Promise<void> {
  const supabase = await createClient();
  const { questionId, speech, vision } = params;

  if (
    speech &&
    (speech.transcript || speech.audioDurationSec || speech.fillerWordCount)
  ) {
    await supabase
      .from("speech_metrics")
      .upsert(
        {
          question_id: questionId,
          transcript: speech.transcript || null,
          audio_duration_sec: speech.audioDurationSec,
          words_per_minute: speech.wordsPerMinute,
          pause_count: speech.pauseCount ?? 0,
          avg_pause_sec: speech.avgPauseSec,
          filler_word_count: speech.fillerWordCount ?? 0,
          filler_density: speech.fillerDensity,
          fluency_score: speech.fluencyScore,
          transcription_source: speech.transcriptionSource ?? "web_speech",
        },
        { onConflict: "question_id" },
      );
  }

  if (vision) {
    await supabase
      .from("vision_metrics")
      .upsert(
        {
          question_id: questionId,
          duration_sec: vision.durationSec,
          sample_count: vision.sampleCount,
          eye_contact_pct: vision.eyeContactPct,
          blink_count: vision.blinkCount,
          blink_rate_per_min: vision.blinkRatePerMin,
          avg_confidence: vision.avgConfidence,
          confidence_samples: vision.confidenceSamples,
          head_pitch_avg: vision.headPitchAvg,
          head_yaw_avg: vision.headYawAvg,
          head_roll_avg: vision.headRollAvg,
          smile_pct: vision.smilePct,
          posture_score: vision.postureScore,
        },
        { onConflict: "question_id" },
      );
  }
}

export { clampSpeech, clampVision };