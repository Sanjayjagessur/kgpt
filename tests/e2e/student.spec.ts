import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { adminClient, createTestStudent, deleteTestStudent } from "./helpers/supabase";

test.skip(!adminClient(), "Supabase keys are not configured");

let student: { id: string; email: string; password: string } | null = null;

test.beforeEach(async ({}, testInfo) => {
  student = await createTestStudent(testInfo.project.name);
});

test.afterEach(async () => {
  if (student) await deleteTestStudent(student.id);
});

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(student!.email);
  await page.getByLabel("Password").fill(student!.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function onboard(page: Page) {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Name").fill("Aisha");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /Grade 10/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Clear" }).click();
  await page.getByRole("checkbox", { name: "Mathematics" }).click();
  await page.getByRole("checkbox", { name: "Physics" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start learning" }).click();
  await expect(page).toHaveURL(/\/learn$/, { timeout: 20_000 });
}

test("new student onboards and lands on a personalised home", async ({ page }) => {
  await signIn(page);
  await onboard(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Aisha");
  const subjects = page.getByRole("region", { name: "Your subjects" }).getByRole("link");
  await expect(subjects).toHaveCount(2);
  await expect(page.getByRole("region", { name: "This week" })).toBeVisible();
});

test("onboarding blocks an empty subject list", async ({ page }) => {
  await signIn(page);
  await page.getByLabel("Name").fill("Ravi");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /Grade 7/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Clear" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "at least one subject" })).toBeVisible();
});

test("home has no WCAG A/AA violations in light and dark", async ({ page }) => {
  await signIn(page);
  await onboard(page);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.reload();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations, `${scheme}: ${results.violations.map((v) => v.id).join(", ")}`).toEqual([]);
  }
});

test("Ctrl+K opens search and jumps to a subject", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard shortcut is a desktop feature");
  await signIn(page);
  await onboard(page);
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("phys");
  await page.getByRole("option", { name: "Physics" }).click();
  await expect(page).toHaveURL(/\/learn\/physics$/);
});

test("signed-in students are sent from sign-in to learning", async ({ page }) => {
  await signIn(page);
  await onboard(page);
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/learn$/);
});
