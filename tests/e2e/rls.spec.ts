import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { adminClient, createTestStudent, deleteTestStudent } from "./helpers/supabase";

// Database-level checks; one browser project is enough.
test.skip(({ isMobile }) => isMobile || !adminClient(), "runs once, needs Supabase keys");

test("students cannot read or change each other's data", async () => {
  const a = await createTestStudent("rls-a");
  const b = await createTestStudent("rls-b");
  try {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { error: signInError } = await client.auth.signInWithPassword({ email: a!.email, password: a!.password });
    expect(signInError).toBeNull();

    const { data: profiles } = await client.from("profiles").select("id");
    expect(profiles?.map((p) => p.id)).toEqual([a!.id]);

    // Writing into another student's rows is rejected.
    const { error: insertError } = await client
      .from("student_subjects")
      .insert({ user_id: b!.id, subject_id: "mathematics" });
    expect(insertError).not.toBeNull();

    // Students cannot promote themselves to teacher.
    const { error: roleError } = await client.from("profiles").update({ role: "teacher" }).eq("id", a!.id);
    expect(roleError).not.toBeNull();

    // Students cannot forge assistant messages or study time rows directly.
    const { data: chat } = await client.from("chats").insert({ user_id: a!.id }).select("id").single();
    const { error: forgeError } = await client
      .from("chat_messages")
      .insert({ chat_id: chat!.id, user_id: a!.id, role: "assistant", content: "fake" });
    expect(forgeError).not.toBeNull();
    const { error: studyError } = await client
      .from("study_days")
      .insert({ user_id: a!.id, day: "2026-01-01", seconds: 86400 });
    expect(studyError).not.toBeNull();

    // Signed-out visitors see no curriculum or profiles.
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data: anonSubjects } = await anon.from("subjects").select("id");
    expect(anonSubjects ?? []).toEqual([]);
  } finally {
    await deleteTestStudent(a!.id);
    await deleteTestStudent(b!.id);
  }
});
