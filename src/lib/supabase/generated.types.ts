export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          requests: number
          user_id: string
          window_start: string
        }
        Insert: {
          requests?: number
          user_id: string
          window_start: string
        }
        Update: {
          requests?: number
          user_id?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          id: number
          kind: Database["public"]["Enums"]["bookmark_kind"]
          label: string
          ref_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          kind: Database["public"]["Enums"]["bookmark_kind"]
          label?: string
          ref_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          kind?: Database["public"]["Enums"]["bookmark_kind"]
          label?: string
          ref_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachments: Json
          chat_id: string
          content: string
          created_at: string
          id: number
          mode: Database["public"]["Enums"]["chat_mode"]
          role: Database["public"]["Enums"]["chat_role"]
          user_id: string
        }
        Insert: {
          attachments?: Json
          chat_id: string
          content: string
          created_at?: string
          id?: never
          mode?: Database["public"]["Enums"]["chat_mode"]
          role: Database["public"]["Enums"]["chat_role"]
          user_id: string
        }
        Update: {
          attachments?: Json
          chat_id?: string
          content?: string
          created_at?: string
          id?: never
          mode?: Database["public"]["Enums"]["chat_mode"]
          role?: Database["public"]["Enums"]["chat_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string
          id: string
          mode: Database["public"]["Enums"]["chat_mode"]
          subject_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["chat_mode"]
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["chat_mode"]
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          answer: string
          awarded_marks: number
          created_at: string
          feedback: Json
          id: number
          question_id: number
          user_id: string
        }
        Insert: {
          answer: string
          awarded_marks: number
          created_at?: string
          feedback: Json
          id?: never
          question_id: number
          user_id: string
        }
        Update: {
          answer?: string
          awarded_marks?: number
          created_at?: string
          feedback?: Json
          id?: never
          question_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "exam_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          created_at: string
          id: number
          locale: Database["public"]["Enums"]["locale_code"]
          mark_scheme: Json
          marks: number
          prompt: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          locale: Database["public"]["Enums"]["locale_code"]
          mark_scheme: Json
          marks: number
          prompt: string
          unit_id: string
        }
        Update: {
          created_at?: string
          id?: never
          locale?: Database["public"]["Enums"]["locale_code"]
          mark_scheme?: Json
          marks?: number
          prompt?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          created_at: string
          due_on: string
          ease: number
          front: string
          id: number
          interval_days: number
          last_reviewed_at: string | null
          repetitions: number
          unit_id: string
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string
          due_on?: string
          ease?: number
          front: string
          id?: never
          interval_days?: number
          last_reviewed_at?: string | null
          repetitions?: number
          unit_id: string
          user_id: string
        }
        Update: {
          back?: string
          created_at?: string
          due_on?: string
          ease?: number
          front?: string
          id?: never
          interval_days?: number
          last_reviewed_at?: string | null
          repetitions?: number
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_content: {
        Row: {
          content: Json
          generated_at: string
          lesson_id: string
          locale: Database["public"]["Enums"]["locale_code"]
          model: string
        }
        Insert: {
          content: Json
          generated_at?: string
          lesson_id: string
          locale: Database["public"]["Enums"]["locale_code"]
          model: string
        }
        Update: {
          content?: Json
          generated_at?: string
          lesson_id?: string
          locale?: Database["public"]["Enums"]["locale_code"]
          model?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_content_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          best_score: number | null
          completed_at: string | null
          last_viewed_at: string
          lesson_id: string
          status: Database["public"]["Enums"]["lesson_status"]
          user_id: string
        }
        Insert: {
          best_score?: number | null
          completed_at?: string | null
          last_viewed_at?: string
          lesson_id: string
          status?: Database["public"]["Enums"]["lesson_status"]
          user_id: string
        }
        Update: {
          best_score?: number | null
          completed_at?: string | null
          last_viewed_at?: string
          lesson_id?: string
          status?: Database["public"]["Enums"]["lesson_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          id: string
          objectives: Json
          position: number
          title: Json
          unit_id: string
        }
        Insert: {
          id?: string
          objectives?: Json
          position: number
          title: Json
          unit_id: string
        }
        Update: {
          id?: string
          objectives?: Json
          position?: number
          title?: Json
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_events: {
        Row: {
          category: string
          created_at: string
          direction: string
          id: number
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          direction: string
          id?: never
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          direction?: string
          id?: never
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body: string
          created_at: string
          id: string
          source: Json
          subject_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          source?: Json
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          source?: Json
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          grade: number | null
          id: string
          onboarded_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          school_id: string | null
          tutor_locale: Database["public"]["Enums"]["locale_code"]
          ui_locale: Database["public"]["Enums"]["locale_code"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          grade?: number | null
          id: string
          onboarded_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          school_id?: string | null
          tutor_locale?: Database["public"]["Enums"]["locale_code"]
          ui_locale?: Database["public"]["Enums"]["locale_code"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          grade?: number | null
          id?: string
          onboarded_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          school_id?: string | null
          tutor_locale?: Database["public"]["Enums"]["locale_code"]
          ui_locale?: Database["public"]["Enums"]["locale_code"]
          updated_at?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json
          completed_at: string | null
          created_at: string
          id: number
          questions: Json
          score: number | null
          unit_id: string
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          id?: never
          questions: Json
          score?: number | null
          unit_id: string
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          id?: never
          questions?: Json
          score?: number | null
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_subjects: {
        Row: {
          created_at: string
          subject_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          subject_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subjects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_days: {
        Row: {
          day: string
          seconds: number
          user_id: string
        }
        Insert: {
          day: string
          seconds?: number
          user_id: string
        }
        Update: {
          day?: string
          seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_grades: {
        Row: {
          grade: number
          subject_id: string
        }
        Insert: {
          grade: number
          subject_id: string
        }
        Update: {
          grade?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_grades_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          id: string
          sort: number
        }
        Insert: {
          id: string
          sort?: number
        }
        Update: {
          id?: string
          sort?: number
        }
        Relationships: []
      }
      topic_mastery: {
        Row: {
          level: Database["public"]["Enums"]["mastery_level"]
          score: number
          unit_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          level?: Database["public"]["Enums"]["mastery_level"]
          score?: number
          unit_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          level?: Database["public"]["Enums"]["mastery_level"]
          score?: number
          unit_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_mastery_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_mastery_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_summaries: {
        Row: {
          content: Json
          generated_at: string
          locale: Database["public"]["Enums"]["locale_code"]
          model: string
          unit_id: string
        }
        Insert: {
          content: Json
          generated_at?: string
          locale: Database["public"]["Enums"]["locale_code"]
          model: string
          unit_id: string
        }
        Update: {
          content?: Json
          generated_at?: string
          locale?: Database["public"]["Enums"]["locale_code"]
          model?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_summaries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          grade: number
          id: string
          position: number
          subject_id: string
          summary: Json
          title: Json
        }
        Insert: {
          grade: number
          id?: string
          position: number
          subject_id: string
          summary?: Json
          title: Json
        }
        Update: {
          grade?: number
          id?: string
          position?: number
          subject_id?: string
          summary?: Json
          title?: Json
        }
        Relationships: [
          {
            foreignKeyName: "units_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_ai_quota: {
        Args: { p_limit?: number; p_window_seconds?: number }
        Returns: number
      }
      log_study_time: { Args: { p_seconds: number }; Returns: undefined }
    }
    Enums: {
      bookmark_kind: "lesson" | "unit" | "message"
      chat_mode: "auto" | "explain" | "practice" | "homework" | "writing"
      chat_role: "user" | "assistant"
      lesson_status: "not_started" | "in_progress" | "completed"
      locale_code: "en" | "fr" | "mfe"
      mastery_level: "not_started" | "learning" | "mastered"
      user_role: "student" | "teacher"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      bookmark_kind: ["lesson", "unit", "message"],
      chat_mode: ["auto", "explain", "practice", "homework", "writing"],
      chat_role: ["user", "assistant"],
      lesson_status: ["not_started", "in_progress", "completed"],
      locale_code: ["en", "fr", "mfe"],
      mastery_level: ["not_started", "learning", "mastered"],
      user_role: ["student", "teacher"],
    },
  },
} as const
