import { expect, type Page } from "@playwright/test";

export async function signIn(page: Page, student: { email: string; password: string }) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(student.email);
  await page.getByLabel("Password").fill(student.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

/** Completes onboarding as a student in the given grade (default Grade 10) taking the given subjects. */
export async function onboard(page: Page, subjects = ["Mathematics", "Physics"], grade = 10) {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Name").fill("Aisha");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: new RegExp(`Grade ${grade}\\b`) }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Clear" }).click();
  for (const s of subjects) await page.getByRole("checkbox", { name: s, exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start learning" }).click();
  await expect(page).toHaveURL(/\/learn$/, { timeout: 20_000 });
}
