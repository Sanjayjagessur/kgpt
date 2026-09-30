import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { schedule } from "../../src/lib/sm2";
import { onboard, signIn } from "./helpers/flows";
import { adminClient, createTestStudent, deleteTestStudent } from "./helpers/supabase";

// Grade 10 Mathematics, Unit 1. Its English summary, flashcards, quiz and exam
// questions are already cached, so these tests never generate content.
const UNIT = "7899c924-4998-5184-bbda-1a63f3c18c3b";
const UNIT_URL = `/revision/mathematics/${UNIT}`;

test.skip(!adminClient(), "Supabase keys are not configured");

let student: { id: string; email: string; password: string } | null = null;

test.beforeEach(async ({ page }, testInfo) => {
  student = await createTestStudent(`rev-${testInfo.project.name}`);
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

test("revision home leads to a subject, a unit and its summary", async ({ page, isMobile }) => {
  await page.goto("/revision");
  await expect(page.getByRole("heading", { level: 1, name: "Revision" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Due today" })).toContainText("All caught up");
  await expectNoAxeViolations(page);

  // Phones list subjects on the page; larger screens have the sidebar.
  const subjects = isMobile
    ? page.getByRole("region", { name: "Your subjects" })
    : page.getByRole("navigation", { name: "Revision subjects" });
  await subjects.getByRole("link", { name: /Mathematics/ }).click();
  await expect(page).toHaveURL(/\/revision\/mathematics$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mathematics");

  await page.getByRole("link", { name: /Numbers and number systems/ }).click();
  await expect(page).toHaveURL(new RegExp(`${UNIT_URL}$`));
  const tabs = page.getByRole("navigation", { name: "Revision for this unit" });
  await expect(tabs.getByRole("link", { name: "Summary" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Key ideas" })).toBeVisible();
  await expect(page.locator(".katex").first()).toBeVisible();
  await expectNoAxeViolations(page);
});

test("add flashcards, review them with SM-2 and clear the daily queue", async ({ page }) => {
  await page.goto(`${UNIT_URL}/flashcards`);
  await page.getByRole("button", { name: /Add \d+ cards to my reviews/ }).click();

  const session = page.getByRole("region", { name: "Flashcard review" });
  await expect(session).toBeVisible();
  const total = Number((await session.getByText(/^Card 1 of \d+$/).textContent())!.match(/of (\d+)/)![1]);
  expect(total).toBeGreaterThanOrEqual(4);
  await expectNoAxeViolations(page);

  // Reveal with the button, rate "Good" (next review tomorrow).
  await page.getByRole("button", { name: "Show answer" }).click();
  await expect(session.getByText("Answer", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Good/ }).click();
  await expect(session.getByText(`Card 2 of ${total}`)).toBeVisible();

  // Keyboard: Space reveals, 1 rates "Again" (the card goes to the back of the queue).
  await page.getByRole("button", { name: "Show answer" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("group", { name: "How well did you remember it?" })).toBeVisible();
  await page.keyboard.press("1");
  await expect(session.getByText(`Card 3 of ${total + 1}`)).toBeVisible();

  // Ratings are saved server-side with the new schedule.
  await expect
    .poll(async () => {
      const { data } = await adminClient()!
        .from("flashcards")
        .select("repetitions, last_reviewed_at")
        .eq("user_id", student!.id)
        .not("last_reviewed_at", "is", null);
      return (data ?? []).map((c) => c.repetitions).sort();
    })
    .toEqual([0, 1]);

  // The rest are still due today, so they show up in the daily queue.
  await page.goto("/revision");
  await expect(page.getByRole("region", { name: "Due today" })).toContainText(`${total - 2} flashcards`);
  await page.getByRole("link", { name: "Review now" }).click();
  await expect(page).toHaveURL(/\/revision\/review$/);
  await expect(page.getByRole("region", { name: "Flashcard review" })).toContainText("Mathematics");

  for (let i = 0; i < total - 2; i++) {
    await page.getByRole("button", { name: "Show answer" }).click();
    await page.getByRole("button", { name: /^Easy/ }).click();
  }
  await expect(page.getByText("Session complete")).toBeVisible();
  await page.getByRole("link", { name: "Back to revision" }).click();
  await expect(page.getByRole("region", { name: "Due today" })).toContainText("All caught up");
});

test("a quiz is marked on the server and shows explanations", async ({ page }) => {
  await page.goto(`${UNIT_URL}/quiz`);
  await page.getByRole("button", { name: "Start quiz" }).click();

  const questions = page.locator("ol > li").filter({ has: page.getByRole("radio") });
  await expect(questions).toHaveCount(6);
  const submit = page.getByRole("button", { name: "Submit answers" });
  await expect(submit).toBeDisabled();
  for (let i = 0; i < 6; i++) await questions.nth(i).locator("label").first().click();
  await expect(page.getByText("All answered. Submit to see your score.")).toBeVisible();
  await expectNoAxeViolations(page);
  await submit.click();

  await expect(page.getByRole("status")).toContainText(/\d of 6 correct/);
  await expect(page.getByText(/^Correct$|^The answer was [A-D]$/).first()).toBeVisible();

  const { data: attempts } = await adminClient()!
    .from("quiz_attempts")
    .select("score, completed_at")
    .eq("user_id", student!.id);
  expect(attempts).toHaveLength(1);
  expect(attempts![0].completed_at).not.toBeNull();

  // The best score shows on the subject page.
  await page.goto("/revision/mathematics");
  await expect(page.getByRole("link", { name: /Numbers and number systems/ })).toContainText(
    `Best quiz ${Math.round(Number(attempts![0].score))}%`,
  );
});

test("an exam answer is marked against the mark scheme", async ({ page }) => {
  // The AI marking call is replaced by a canned result; validation is covered below.
  await page.route(/\/api\/revision\/exam\/\d+\/mark$/, async (route) => {
    await route.fulfill({
      json: {
        awarded: 1,
        feedback: {
          points: [
            { point: "Adds the indices", marks: 1, awarded: 1, comment: "Well done: $3^7$." },
            { point: "Final answer", marks: 1, awarded: 0, comment: "Missing the final answer." },
          ],
          summary: "Good start.",
          nextStep: "Always finish with a single power.",
        },
      },
    });
  });

  await page.goto(`${UNIT_URL}/exam`);
  await expect(page.getByRole("heading", { name: "Exam practice" })).toBeVisible();
  const first = page.getByRole("article").first();
  const mark = first.getByRole("button", { name: "Mark my answer" });
  await expect(mark).toBeDisabled();
  await first.getByRole("textbox", { name: "Your answer" }).fill("3^5 x 3^2 = 3^7");
  await expectNoAxeViolations(page);
  await mark.click();

  await expect(first.getByText("Good start.")).toBeVisible();
  await expect(first.getByText("Mark scheme")).toBeVisible();
  await expect(first.getByText("Always finish with a single power.")).toBeVisible();
  await first.getByRole("button", { name: "Try again" }).click();
  await expect(first.getByRole("textbox", { name: "Your answer" })).toHaveValue("3^5 x 3^2 = 3^7");
});

test("the marking API rejects empty answers and unknown questions", async ({ page, isMobile }) => {
  test.skip(isMobile, "API checks run once");
  const empty = await page.request.post("/api/revision/exam/1/mark", { data: { answer: "   " } });
  expect(empty.status()).toBe(400);
  const unknown = await page.request.post("/api/revision/exam/999999999/mark", { data: { answer: "x" } });
  expect(unknown.status()).toBe(404);
  const badKind = await page.request.post(`/api/revision/${UNIT}/essay`);
  expect(badKind.status()).toBe(404);
  // Cached material is served without spending AI quota.
  const cached = await page.request.post(`/api/revision/${UNIT}/quiz`);
  expect(await cached.json()).toEqual({ ok: true });
});

test("SM-2 grows intervals on success and resets on a lapse", async ({ isMobile }) => {
  test.skip(isMobile, "pure logic, runs once");
  const today = "2026-09-30";
  let card = { ease: 2.5, intervalDays: 0, repetitions: 0 };
  const first = schedule(card, "good", today);
  expect(first).toMatchObject({ intervalDays: 1, repetitions: 1, dueOn: "2026-10-01" });
  card = first;
  const second = schedule(card, "good", today);
  expect(second).toMatchObject({ intervalDays: 6, repetitions: 2, dueOn: "2026-10-06" });
  const third = schedule(second, "easy", today);
  expect(third.intervalDays).toBe(Math.round(6 * 2.5));
  expect(third.ease).toBeCloseTo(2.6);
  const lapse = schedule(third, "again", today);
  expect(lapse).toMatchObject({ intervalDays: 1, repetitions: 0 });
  expect(lapse.ease).toBeGreaterThanOrEqual(1.3);
});
