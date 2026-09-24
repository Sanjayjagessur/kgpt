/**
 * Hand-maintained until the project is linked; regenerate with
 * `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`.
 * Mirrors supabase/migrations.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type LocaleCode = "en" | "fr" | "mfe";
export type LessonStatus = "not_started" | "in_progress" | "completed";
export type MasteryLevel = "not_started" | "learning" | "mastered";
export type ChatMode = "auto" | "explain" | "practice" | "homework" | "writing";
export type ChatRole = "user" | "assistant";
export type BookmarkKind = "lesson" | "unit" | "message";
export type Localized = Partial<Record<LocaleCode, string>>;

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type ProfileRow = {
  id: string;
  display_name: string | null;
  grade: number | null;
  ui_locale: LocaleCode;
  tutor_locale: LocaleCode;
  role: "student" | "teacher";
  school_id: string | null;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UnitRow = {
  id: string;
  subject_id: string;
  grade: number;
  position: number;
  title: Localized;
  summary: Localized;
};

export type LessonRow = {
  id: string;
  unit_id: string;
  position: number;
  title: Localized;
  objectives: Json;
};

export type ChatRow = {
  id: string;
  user_id: string;
  title: string;
  subject_id: string | null;
  mode: ChatMode;
  created_at: string;
  updated_at: string;
};

export type ChatMessageRow = {
  id: number;
  chat_id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  mode: ChatMode;
  attachments: Json;
  created_at: string;
};

export type NoteRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  subject_id: string | null;
  source: Json;
  created_at: string;
  updated_at: string;
};

export type FlashcardRow = {
  id: number;
  user_id: string;
  unit_id: string;
  front: string;
  back: string;
  ease: number;
  interval_days: number;
  repetitions: number;
  due_on: string;
  last_reviewed_at: string | null;
  created_at: string;
};

export type ExamQuestionRow = {
  id: number;
  unit_id: string;
  locale: LocaleCode;
  prompt: string;
  marks: number;
  mark_scheme: Json;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      subjects: Table<{ id: string; sort: number }>;
      subject_grades: Table<{ subject_id: string; grade: number }>;
      units: Table<UnitRow>;
      lessons: Table<LessonRow>;
      lesson_content: Table<{
        lesson_id: string;
        locale: LocaleCode;
        content: Json;
        model: string;
        generated_at: string;
      }>;
      unit_summaries: Table<{
        unit_id: string;
        locale: LocaleCode;
        content: Json;
        model: string;
        generated_at: string;
      }>;
      exam_questions: Table<ExamQuestionRow>;
      profiles: Table<ProfileRow>;
      student_subjects: Table<{ user_id: string; subject_id: string; created_at: string }>;
      lesson_progress: Table<{
        user_id: string;
        lesson_id: string;
        status: LessonStatus;
        last_viewed_at: string;
        completed_at: string | null;
      }>;
      topic_mastery: Table<{
        user_id: string;
        unit_id: string;
        level: MasteryLevel;
        score: number;
        updated_at: string;
      }>;
      study_days: Table<{ user_id: string; day: string; seconds: number }>;
      chats: Table<ChatRow>;
      chat_messages: Table<ChatMessageRow>;
      notes: Table<NoteRow>;
      bookmarks: Table<{
        id: number;
        user_id: string;
        kind: BookmarkKind;
        ref_id: string;
        label: string;
        created_at: string;
      }>;
      flashcards: Table<FlashcardRow>;
      quiz_attempts: Table<{
        id: number;
        user_id: string;
        unit_id: string;
        questions: Json;
        answers: Json;
        score: number | null;
        created_at: string;
        completed_at: string | null;
      }>;
      exam_attempts: Table<{
        id: number;
        user_id: string;
        question_id: number;
        answer: string;
        awarded_marks: number;
        feedback: Json;
        created_at: string;
      }>;
      ai_usage: Table<{ user_id: string; window_start: string; requests: number }>;
      moderation_events: Table<{
        id: number;
        user_id: string;
        category: string;
        direction: "input" | "output";
        created_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      consume_ai_quota: {
        Args: { p_window_seconds?: number; p_limit?: number };
        Returns: number;
      };
      log_study_time: { Args: { p_seconds: number }; Returns: undefined };
    };
    Enums: {
      locale_code: LocaleCode;
      lesson_status: LessonStatus;
      mastery_level: MasteryLevel;
      chat_mode: ChatMode;
      chat_role: ChatRole;
      bookmark_kind: BookmarkKind;
      user_role: "student" | "teacher";
    };
    CompositeTypes: Record<string, never>;
  };
};
