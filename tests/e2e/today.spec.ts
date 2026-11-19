import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { onboard, signIn } from "./helpers/flows";
import { adminClient, createTestStudent, deleteTestStudent } from "./helpers/supabase";

test.skip(!adminClient(), "Supabase keys are not configured");

let student: { id: string; email: string; password: string } | null = null;

test.beforeEach(async ({ page }, testInfo) => {
  student = await createTestStudent(`today-${testInfo.project.name}`);
  await signIn(page, student!);
  await onboard(page, ["Mathematics", "Physics"], 9);
});

test.afterEach(async () => {
  if (student) await deleteTestStudent(student.id);
});

test("a new Grade 9 student sees an empty plan and an NCE suggestion", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Nothing planned yet" })).toBeVisible();
  await expect(page.getByLabel("Exam name")).toHaveValue("NCE");
});

test("due flashcards become step 1 and an exam date starts a countdown", async ({ page }) => {
  const admin = adminClient()!;
  const { data: unit } = await admin
    .from("units")
    .select("id")
    .eq("subject_id", "mathematics")
    .eq("grade", 9)
    .eq("position", 3)
    .single();
  await admin.from("flashcards").insert([
    { user_id: student!.id, unit_id: unit!.id, front: "Solve 2x = 8", back: "x = 4" },
    { user_id: student!.id, unit_id: unit!.id, front: "Solve x + 3 = 5", back: "x = 2" },
  ]);
  await page.reload();

  const plan = page.getByRole("region", { name: "Today's plan" });
  await expect(plan.getByRole("link", { name: /Review 2 flashcards/ })).toHaveAttribute("href", "/revision/review");

  // Exam countdown: a date 30 days from today (Mauritius time).
  const date = new Date(Date.now() + 30 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Indian/Mauritius" });
  await page.getByLabel("Date").fill(date);
  await page.getByRole("button", { name: "Save exam" }).click();
  const exam = page.getByRole("region", { name: "Next exam" });
  await expect(exam).toContainText("30");
  await expect(exam).toContainText("NCE on");

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  await exam.getByRole("button", { name: "Remove NCE" }).click();
  await expect(page.getByRole("heading", { name: "Add your next exam" })).toBeVisible();
});

test("Today page has no horizontal scroll", async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
