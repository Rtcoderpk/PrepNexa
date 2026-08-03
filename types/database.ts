export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
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
          status: "in_progress" | "completed";
          overall_score: number | null;
          summary: string | null;
          strengths: string[] | null;
          areas_to_improve: string[] | null;
          resume_file_id: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          job_role?: string | null;
          job_description?: string | null;
          status: "in_progress" | "completed";
          overall_score?: number | null;
          summary?: string | null;
          strengths?: string[] | null;
          areas_to_improve?: string[] | null;
          resume_file_id?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          job_role?: string | null;
          job_description?: string | null;
          status?: "in_progress" | "completed";
          overall_score?: number | null;
          summary?: string | null;
          strengths?: string[] | null;
          areas_to_improve?: string[] | null;
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
          score?: number | null;
          feedback?: string | null;
          is_follow_up?: boolean;
          created_at?: string;
        };
        Update: {
          answer?: string | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
