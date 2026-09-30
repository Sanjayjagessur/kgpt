import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { addDays, isoDay } from "../../src/lib/streak";
import { onboard, signIn } from "./helpers/flows";
import { adminClient, createTestStudent, deleteTestStudent } from "./helpers/supabase";

// Grade 10 Mathematics, Unit 1 (content cached; no AI calls in these tests).
const UNIT = "7899c924-4998-5184-bbda-1a63f3c18c3b";
const LESSON = "be0da5e5-db62-57bc-b7a5-dc927f299571";

test.skip(!adminClient(), "Supabase keys are not configured");

let student: { id: string; email: string; password: string } | null = null;

test.beforeEach(async ({ page }, testInfo) => {
  student = await createTestStudent(`p5-${testInfo.project.name}`);
  await signIn(page, student!);
  await onboard(page);
});

test.afterEach(async () => {
  if (student) await deleteTestStudent(student.id);
});

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id} (${v.nodes[0]?.target})`)).toEqual([]);
}

test("progress shows streaks, study time and weak areas", async ({ page }) => {
  const admin = adminClient()!;
  const today = isoDay(new Date());
  // Three days in a row up to today, and an older five-day run.
  await admin.from("study_days").upsert(
    [0, 1, 2, 10, 11, 12, 13, 14].map((d) => ({ user_id: student!.id, day: addDays(today, -d), seconds: 1500 })),
    { onConflict: "user_id,day" },
  );
  await admin.from("quiz_attempts").insert({
    user_id: student!.id,
    unit_id: UNIT,
    questions: [],
    score: 40,
    completed_at: new Date().toISOString(),
  });

  await page.goto("/progress");
  await expect(page.getByRole("heading", { level: 1, name: "Progress" })).toBeVisible();
  const stats = page.getByRole("region", { name: "Summary" });
  await expect(stats.getByText("Current streak")).toBeVisible();
  await expect(stats).toContainText("3 days");
  await expect(stats).toContainText("5 days");
  await expect(stats).toContainText("1 h 15 min");

  const weak = page.getByRole("region", { name: "Areas to work on" });
  await expect(weak.getByRole("link", { name: /Numbers and number systems/ })).toContainText("Best quiz 40%");
  await expect(page.getByRole("table", { name: "Time studied on each of the last 14 days" })).toHaveCount(1);
  await expectNoAxeViolations(page);

  await weak.getByRole("link", { name: /Numbers and number systems/ }).click();
  await expect(page).toHaveURL(new RegExp(`/revision/mathematics/${UNIT}$`));
});

test("a strong quiz raises unit mastery", async ({ page }) => {
  const admin = adminClient()!;
  const { data: lessons } = await admin.from("lessons").select("id").eq("unit_id", UNIT);
  // All lessons done, but with weak check scores: not mastered yet.
  await admin.from("lesson_progress").insert(
    lessons!.map((l) => ({ user_id: student!.id, lesson_id: l.id, status: "completed" as const, best_score: 50, completed_at: new Date().toISOString() })),
  );

  await page.goto(`/revision/mathematics/${UNIT}/quiz`);
  await page.getByRole("button", { name: "Start quiz" }).click();
  const questions = page.locator("ol > li").filter({ has: page.getByRole("radio") });
  await expect(questions).toHaveCount(6);

  // Answer correctly, reading the answers from the stored attempt.
  const { data: attempt } = await admin
    .from("quiz_attempts")
    .select("questions")
    .eq("user_id", student!.id)
    .is("completed_at", null)
    .single();
  const answers = (attempt!.questions as { correctOption: number }[]).map((q) => q.correctOption);
  for (let i = 0; i < 6; i++) await questions.nth(i).locator("label").nth(answers[i]).click();
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByRole("status")).toContainText("6 of 6 correct");

  await expect
    .poll(async () => {
      const { data } = await admin.from("topic_mastery").select("level").eq("user_id", student!.id).eq("unit_id", UNIT).maybeSingle();
      return data?.level;
    })
    .toBe("mastered");
  await page.goto("/learn/mathematics");
  await expect(page.getByRole("link", { name: /Numbers and number systems/ })).toContainText("Mastered");
});

test("write, find and delete a note", async ({ page }) => {
  await page.goto("/notes");
  await expect(page.getByText("No notes yet")).toBeVisible();
  await page.getByRole("button", { name: "New note" }).click();
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+\?new=1$/);

  await expect(page.getByRole("textbox", { name: "Title" })).toBeFocused();
  await page.getByRole("textbox", { name: "Title" }).fill("Index laws");
  await page.getByRole("combobox", { name: "Subject" }).selectOption({ label: "Mathematics" });
  await page.getByRole("textbox", { name: "Note" }).fill("Multiply: add the powers, so $a^m a^n = a^{m+n}$.");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.keyboard.press("Control+s");
  await expect(page.getByText("All changes saved")).toBeVisible();

  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.locator(".katex").first()).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Notes" }).first().click();
  await expect(page).toHaveURL(/\/notes$/);
  const search = page.getByRole("searchbox", { name: "Search notes" });
  await search.fill("powers");
  await expect(page.getByRole("link", { name: /Index laws/ })).toBeVisible();
  await search.fill("photosynthesis");
  await expect(page.getByText("No notes match")).toBeVisible();
  await search.fill("");
  await page.getByRole("combobox", { name: "Filter by subject" }).selectOption({ label: "Physics" });
  await expect(page.getByRole("link", { name: /Index laws/ })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Filter by subject" }).selectOption({ label: "Mathematics" });
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: /Index laws/ }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete note" }).click();
  await expect(page).toHaveURL(/\/notes$/);
  await expect(page.getByText("No notes yet")).toBeVisible();
});

test("bookmark a lesson and find it under bookmarks", async ({ page }) => {
  await page.goto(`/learn/mathematics/${UNIT}/${LESSON}`);
  await page.getByRole("button", { name: "Bookmark", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bookmarked" })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/notes?view=bookmarks");
  const link = page.getByRole("link", { name: /Sets and Venn diagrams/ });
  await expect(link).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Remove bookmark: Sets and Venn diagrams" }).click();
  await expect(page.getByText("No bookmarks yet")).toBeVisible();
});

test("global search finds lessons and notes", async ({ page, isMobile }) => {
  await adminClient()!.from("notes").insert({ user_id: student!.id, title: "Quadratic tricks", body: "Complete the square." });

  await page.goto("/learn");
  if (isMobile) await page.getByRole("button", { name: "Search" }).click();
  else await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog");
  const input = dialog.getByRole("combobox");
  await input.fill("venn");
  await expect(dialog.getByRole("group", { name: "Lessons" })).toContainText("Sets and Venn diagrams");

  await input.fill("quadratic");
  await expect(dialog.getByRole("group", { name: "Notes" })).toContainText("Quadratic tricks");

  await input.fill("venn");
  await dialog.getByRole("option", { name: /Sets and Venn diagrams/ }).click();
  await expect(page).toHaveURL(new RegExp(`/learn/mathematics/${UNIT}/${LESSON}$`));
});
