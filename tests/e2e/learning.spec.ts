import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { onboard, signIn } from "./helpers/flows";
import { adminClient, createTestStudent, deleteTestStudent } from "./helpers/supabase";

// Grade 10 Mathematics, Unit 1, Lesson 1. Its English content is already cached,
// so these tests never call the AI.
const UNIT = "7899c924-4998-5184-bbda-1a63f3c18c3b";
const LESSON = "be0da5e5-db62-57bc-b7a5-dc927f299571";
const LESSON_URL = `/learn/mathematics/${UNIT}/${LESSON}`;

test.skip(!adminClient(), "Supabase keys are not configured");

let student: { id: string; email: string; password: string } | null = null;

test.beforeEach(async ({ page }, testInfo) => {
  student = await createTestStudent(`learn-${testInfo.project.name}`);
  await signIn(page, student!);
  await onboard(page);
});

test.afterEach(async () => {
  if (student) await deleteTestStudent(student.id);
});

test("browse from subject to unit to lesson", async ({ page }) => {
  await page.getByRole("link", { name: /Mathematics/ }).first().click();
  await expect(page).toHaveURL(/\/learn\/mathematics$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mathematics");

  await page.getByRole("link", { name: /Numbers and number systems/ }).click();
  await expect(page).toHaveURL(new RegExp(`/learn/mathematics/${UNIT}$`));
  await page.getByRole("link", { name: "Start", exact: true }).click();

  await expect(page).toHaveURL(new RegExp(LESSON_URL));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sets and Venn diagrams");
  await expect(page.getByRole("heading", { name: "Check your understanding" })).toBeVisible();
  // Maths is rendered with KaTeX.
  await expect(page.locator(".katex").first()).toBeVisible();
});

test("completing a lesson updates progress and the continue card", async ({ page }) => {
  await page.goto(LESSON_URL);
  const checks = page.locator('section[aria-labelledby="checks-title"] article');
  const count = await checks.count();
  expect(count).toBeGreaterThanOrEqual(3);

  for (let i = 0; i < count; i++) {
    const q = checks.nth(i);
    if ((await q.getByRole("radio").count()) > 0) {
      await q.locator("label").first().click();
      await q.getByRole("button", { name: "Check answer" }).click();
      await expect(q.getByText(/Correct|Not quite/)).toBeVisible();
    } else {
      await q.getByRole("button", { name: "Show model answer" }).click();
      await q.getByRole("button", { name: "Yes, I got it" }).click();
    }
  }
  await expect(page.getByText(new RegExp(`of ${count} correct`))).toBeVisible();

  await page.getByRole("button", { name: "Mark lesson as complete" }).click();
  await expect(page.getByText("Lesson complete")).toBeVisible();
  await expect(page.getByRole("link", { name: "Next lesson" })).toBeVisible();

  await page.goto("/learn");
  const cont = page.getByRole("region", { name: "Continue where you left off" });
  await expect(cont).toContainText("Indices and laws of indices");
  await expect(cont).toContainText("1 of 4 lessons done");
});

test("worked examples reveal one step at a time", async ({ page }) => {
  await page.goto(LESSON_URL);
  const example = page.locator("article").filter({ hasText: "Example 1" });
  await expect(example.locator("[data-step]")).toHaveCount(0);
  await example.getByRole("button", { name: "Show next step" }).click();
  await expect(example.locator("[data-step]")).toHaveCount(1);
  await expect(example.locator("[data-step]").first()).toBeFocused();
  await example.getByRole("button", { name: "Show all steps" }).click();
  await expect(example.getByText("Answer", { exact: true })).toBeVisible();
});

test("subject search filters and shows an empty state", async ({ page }) => {
  const search = page.getByRole("searchbox", { name: "Search your subjects" });
  await search.fill("phy");
  const grid = page.getByRole("region", { name: "Your subjects" });
  await expect(grid.getByRole("link")).toHaveCount(1);
  await search.fill("zzz");
  await expect(grid.getByText(/No subjects match/)).toBeVisible();
  await grid.getByRole("button", { name: "Clear search" }).click();
  await expect(grid.getByRole("link")).toHaveCount(2);
});

test("learning pages have no WCAG A/AA violations", async ({ page }) => {
  for (const url of ["/learn/mathematics", `/learn/mathematics/${UNIT}`, LESSON_URL]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations, `${url}: ${results.violations.map((v) => `${v.id} (${v.nodes[0]?.target})`).join(", ")}`).toEqual([]);
  }
});

test("subjects outside the student's grade or unknown ids are not found", async ({ page }) => {
  // Pages stream inside the shell, so check the not-found view rather than the status code.
  await page.goto("/learn/life-skills"); // Life Skills is Grades 7–9 only
  await expect(page.getByRole("heading", { name: "We can't find that page" })).toBeVisible();
  await page.goto("/learn/mathematics/not-a-uuid");
  await expect(page.getByRole("heading", { name: "We can't find that page" })).toBeVisible();
});

test("the lesson API rejects signed-out requests", async ({ request }) => {
  const res = await request.post(`/api/lessons/${LESSON}/content`);
  expect(res.status()).toBe(401);
});
