import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PUBLIC_PAGES = ["/", "/sign-in", "/sign-up", "/privacy"];

for (const path of PUBLIC_PAGES) {
  test(`${path} has no WCAG A/AA violations (light and dark)`, async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(results.violations, `${scheme}: ${results.violations.map((v) => v.id).join(", ")}`).toEqual([]);
    }
  });

  test(`${path} has no horizontal scroll`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("landing links to sign up", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /get started/i }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/create your account/i);
});

test("app routes redirect signed-out visitors to sign in", async ({ page }) => {
  await page.goto("/learn");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("sign-in validates the email before calling the server", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});

test("interface switches to French from the Accept-Language header", async ({ browser }) => {
  const context = await browser.newContext({ locale: "fr-FR", extraHTTPHeaders: { "Accept-Language": "fr" } });
  const page = await context.newPage();
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bon retour");
  await context.close();
});
