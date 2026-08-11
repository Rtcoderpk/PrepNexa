export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          free_interview_used: boolean;
          resume_analysis_count: number;
          is_premium: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          free_interview_used?: boolean;
          resume_analysis_count?: number;
          is_premium?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
          free_interview_used?: boolean;
          resume_analysis_count?: number;
          is_premium?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      interviews: {
        Row: {
          id: string;
          user_id: string;
          job_role: string | null;
          job_description: string | null;
          type: "behavioral" | "coding";
          status: "in_progress" | "completed";
          overall_score: number | null;
          summary: string | null;
          strengths: string[] | null;
          weaknesses: string[] | null;
          areas_to_improve: string[] | null;
          star_evaluation: string | null;
          hiring_recommendation: string | null;
          improvement_roadmap: string | null;
          technical_score: number | null;
          communication_score: number | null;
          confidence_score: number | null;
          grammar_score: number | null;
          speaking_speed_score: number | null;
          eye_contact_score: number | null;
          body_language_score: number | null;
          resume_file_id: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          job_role?: string | null;
          job_description?: string | null;
          type?: "behavioral" | "coding";
          status?: "in_progress" | "completed";
          overall_score?: number | null;
          summary?: string | null;
          strengths?: string[] | null;
          weaknesses?: string[] | null;
          areas_to_improve?: string[] | null;
          star_evaluation?: string | null;
          hiring_recommendation?: string | null;
          improvement_roadmap?: string | null;
          technical_score?: number | null;
          communication_score?: number | null;
          confidence_score?: number | null;
          grammar_score?: number | null;
          speaking_speed_score?: number | null;
          eye_contact_score?: number | null;
          body_language_score?: number | null;
          resume_file_id?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          job_role?: string | null;
          job_description?: string | null;
          type?: "behavioral" | "coding";
          status?: "in_progress" | "completed";
          overall_score?: number | null;
          summary?: string | null;
          strengths?: string[] | null;
          weaknesses?: string[] | null;
          areas_to_improve?: string[] | null;
          star_evaluation?: string | null;
          hiring_recommendation?: string | null;
          improvement_roadmap?: string | null;
          technical_score?: number | null;
          communication_score?: number | null;
          confidence_score?: number | null;
          grammar_score?: number | null;
          speaking_speed_score?: number | null;
          eye_contact_score?: number | null;
          body_language_score?: number | null;
          resume_file_id?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      interview_questions: {
        Row: {
          id: string;
          interview_id: string;
          user_id: string;
          category: string;
          question: string;
          answer: string | null;
          difficulty: number;
          score: number | null;
          feedback: string | null;
          is_follow_up: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          interview_id: string;
          user_id: string;
          category: string;
          question: string;
          answer?: string | null;
          difficulty?: number;
          score?: number | null;
          feedback?: string | null;
          is_follow_up?: boolean;
          created_at?: string;
        };
        Update: {
          answer?: string | null;
          difficulty?: number;
          score?: number | null;
          feedback?: string | null;
        };
        Relationships: [];
      };
      resume_files: {
        Row: {
          id: string;
          user_id: string;
          storage_path: string;
          file_name: string;
          file_size: number;
          extracted_text: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          storage_path: string;
          file_name: string;
          file_size: number;
          extracted_text?: string | null;
          created_at?: string;
        };
        Update: {
          extracted_text?: string | null;
          file_name?: string | null;
        };
        Relationships: [];
      };
      speech_metrics: {
        Row: {
          id: string;
          question_id: string;
          transcript: string | null;
          audio_duration_sec: number | null;
          words_per_minute: number | null;
          pause_count: number | null;
          avg_pause_sec: number | null;
          filler_word_count: number | null;
          filler_density: number | null;
          fluency_score: number | null;
          transcription_source: "faster_whisper" | "web_speech";
          created_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          transcript?: string | null;
          audio_duration_sec?: number | null;
          words_per_minute?: number | null;
          pause_count?: number | null;
          avg_pause_sec?: number | null;
          filler_word_count?: number | null;
          filler_density?: number | null;
          fluency_score?: number | null;
          transcription_source?: "faster_whisper" | "web_speech";
          created_at?: string;
        };
        Update: {
          transcript?: string | null;
          audio_duration_sec?: number | null;
          words_per_minute?: number | null;
          pause_count?: number | null;
          avg_pause_sec?: number | null;
          filler_word_count?: number | null;
          filler_density?: number | null;
          fluency_score?: number | null;
          transcription_source?: "faster_whisper" | "web_speech";
        };
        Relationships: [];
      };
      vision_metrics: {
        Row: {
          id: string;
          question_id: string;
          duration_sec: number | null;
          sample_count: number | null;
          eye_contact_pct: number | null;
          blink_count: number | null;
          blink_rate_per_min: number | null;
          avg_confidence: number | null;
          confidence_samples: number | null;
          head_pitch_avg: number | null;
          head_yaw_avg: number | null;
          head_roll_avg: number | null;
          smile_pct: number | null;
          posture_score: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          duration_sec?: number | null;
          sample_count?: number | null;
          eye_contact_pct?: number | null;
          blink_count?: number | null;
          blink_rate_per_min?: number | null;
          avg_confidence?: number | null;
          confidence_samples?: number | null;
          head_pitch_avg?: number | null;
          head_yaw_avg?: number | null;
          head_roll_avg?: number | null;
          smile_pct?: number | null;
          posture_score?: number | null;
          created_at?: string;
        };
        Update: {
          duration_sec?: number | null;
          sample_count?: number | null;
          eye_contact_pct?: number | null;
          blink_count?: number | null;
          blink_rate_per_min?: number | null;
          avg_confidence?: number | null;
          confidence_samples?: number | null;
          head_pitch_avg?: number | null;
          head_yaw_avg?: number | null;
          head_roll_avg?: number | null;
          smile_pct?: number | null;
          posture_score?: number | null;
        };
        Relationships: [];
      };
      feedback_reports: {
        Row: {
          id: string;
          interview_id: string;
          user_id: string;
          data: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          interview_id: string;
          user_id: string;
          data: Record<string, unknown>;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: string;
          status: string;
          provider: string;
          transaction_id: string | null;
          start_date: string;
          expiry_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan?: string;
          status?: string;
          provider: string;
          transaction_id?: string | null;
          start_date?: string;
          expiry_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          plan?: string;
          status?: string;
          transaction_id?: string | null;
          expiry_date?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      resume_analyses: {
        Row: {
          id: string;
          user_id: string;
          resume_file_id: string | null;
          ats_score: number | null;
          quality_score: number | null;
          job_match_score: number | null;
          has_job_description: boolean;
          report: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          resume_file_id?: string | null;
          ats_score?: number | null;
          quality_score?: number | null;
          job_match_score?: number | null;
          has_job_description?: boolean;
          report?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      ai_usage_logs: {
        Row: {
          id: string;
          user_id: string | null;
          task: string;
          provider: string | null;
          model: string | null;
          success: boolean;
          error_kind: string | null;
          latency_ms: number | null;
          attempts: number;
          fallback_from: string | null;
          fallback_to: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          task: string;
          provider?: string | null;
          model?: string | null;
          success?: boolean;
          error_kind?: string | null;
          latency_ms?: number | null;
          attempts?: number;
          fallback_from?: string | null;
          fallback_to?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      payment_transactions: {
        Row: {
          id: string;
          user_id: string | null;
          provider: string;
          transaction_id: string;
          event_type: string;
          status: "succeeded" | "failed" | "pending" | "cancelled" | "expired";
          amount: number | null;
          currency: string | null;
          payload: Record<string, unknown> | null;
          processed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          provider: string;
          transaction_id: string;
          event_type: string;
          status: "succeeded" | "failed" | "pending" | "cancelled" | "expired";
          amount?: number | null;
          currency?: string | null;
          payload?: Record<string, unknown> | null;
          processed_at?: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      provider_health: {
        Row: {
          id: string;
          provider: string;
          success_count: number;
          failure_count: number;
          rate_limited_count: number;
          average_latency_ms: number | null;
          last_failure_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          success_count?: number;
          failure_count?: number;
          rate_limited_count?: number;
          average_latency_ms?: number | null;
          last_failure_at?: string | null;
          updated_at?: string;
        };
        Update: {
          success_count?: number;
          failure_count?: number;
          rate_limited_count?: number;
          average_latency_ms?: number | null;
          last_failure_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
