import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { onboard, signIn } from "./helpers/flows";
import { adminClient, createTestStudent, deleteTestStudent } from "./helpers/supabase";

// Grade 10 Mathematics, Unit 1 / Lesson 1 (content cached; no AI calls).
const UNIT = "7899c924-4998-5184-bbda-1a63f3c18c3b";
const LESSON = "be0da5e5-db62-57bc-b7a5-dc927f299571";

async function axe(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${label}: ${v.id} (${v.nodes[0]?.target})`)).toEqual([]);
}

/** Every page has one h1, a title, a main landmark and no horizontal scrolling at 360px. */
async function checkStructure(page: Page, label: string) {
  await expect(page.locator("h1"), `${label}: one h1`).toHaveCount(1);
  expect(await page.title(), `${label}: title`).not.toBe("");
  await expect(page.locator("main"), `${label}: main landmark`).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(0);
}

test.describe("public pages", () => {
  for (const path of ["/", "/sign-in", "/sign-up", "/privacy", "/offline"]) {
    test(`${path} passes axe in light and dark`, async ({ page }) => {
      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        await checkStructure(page, `${path} ${scheme}`);
        await axe(page, `${path} ${scheme}`);
      }
    });
  }
});

test.describe("signed-in pages", () => {
  test.skip(!adminClient(), "Supabase keys are not configured");
  test.setTimeout(240_000);

  let student: { id: string; email: string; password: string } | null = null;
  test.afterEach(async () => {
    if (student) await deleteTestStudent(student.id);
  });

  test("every app page passes axe in light and dark", async ({ page }, testInfo) => {
    student = await createTestStudent(`audit-${testInfo.project.name}`);
    await signIn(page, student!);
    await onboard(page);
    const { data: note } = await adminClient()!
      .from("notes")
      .insert({ user_id: student!.id, title: "Audit note", body: "Some $x^2$ maths." })
      .select("id")
      .single();

    const paths = [
      "/learn",
      "/learn/mathematics",
      `/learn/mathematics/${UNIT}`,
      `/learn/mathematics/${UNIT}/${LESSON}`,
      "/chat",
      "/revision",
      "/revision/mathematics",
      `/revision/mathematics/${UNIT}`,
      `/revision/mathematics/${UNIT}/flashcards`,
      `/revision/mathematics/${UNIT}/quiz`,
      `/revision/mathematics/${UNIT}/exam`,
      "/revision/review",
      "/progress",
      "/notes",
      "/notes?view=bookmarks",
      `/notes/${note!.id}`,
      "/settings",
    ];
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of paths) {
        await page.goto(path);
        // Pages with a single visually hidden h1 still count.
        await checkStructure(page, `${path} ${scheme}`);
        await axe(page, `${path} ${scheme}`);
      }
    }
  });

  test("keyboard users can skip to content and see focus", async ({ page, isMobile }, testInfo) => {
    test.skip(isMobile, "keyboard check runs on desktop");
    student = await createTestStudent(`kbd-${testInfo.project.name}`);
    await signIn(page, student!);
    await onboard(page);
    await page.goto("/learn");
    await page.waitForLoadState("networkidle");
    await page.locator("body").focus();
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
    // The next Tab lands on a control inside the page with a visible focus ring.
    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const style = getComputedStyle(el);
      return { inMain: !!el.closest("main"), ring: style.boxShadow !== "none" || style.outlineStyle !== "none" };
    });
    expect(outline).toEqual({ inMain: true, ring: true });
  });

  test("settings change the name, subjects and language", async ({ page }, testInfo) => {
    student = await createTestStudent(`settings-${testInfo.project.name}`);
    await signIn(page, student!);
    await onboard(page);

    await page.goto("/settings");
    await expect(page.getByText("Everything is saved.")).toBeVisible();
    await page.getByRole("textbox", { name: "Name" }).fill("Ravi");
    await page.getByRole("checkbox", { name: "Chemistry" }).click();
    await page.getByRole("radiogroup", { name: "App language" }).getByRole("radio", { name: "Français" }).click();
    await expect(page.getByText("You have unsaved changes.")).toBeVisible();
    await page.getByRole("button", { name: "Save changes" }).click();

    // The interface switches to French once saved.
    await expect(page.getByRole("heading", { level: 1, name: "Paramètres" })).toBeVisible();
    await page.goto("/learn");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ravi");
    await expect(page.getByRole("link", { name: /Chimie/ })).toBeVisible();

    // A subject that isn't offered in the new grade is dropped when the grade changes.
    await page.goto("/settings");
    await page.getByRole("combobox").first().selectOption("12");
    await expect(page.getByRole("checkbox", { name: "Chimie" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("checkbox", { name: /Drame|Drama/ })).toHaveCount(0);
  });
});

test.describe("PWA", () => {
  test("manifest, icons and service worker are served", async ({ request, isMobile }) => {
    test.skip(isMobile, "runs once");
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest).toMatchObject({ display: "standalone", start_url: "/learn" });
    for (const icon of manifest.icons as { src: string }[]) {
      const res = await request.get(icon.src);
      expect(res.headers()["content-type"]).toContain("image/png");
    }
    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBe(true);
    expect(sw.headers()["cache-control"]).toContain("no-cache");
    const robots = await request.get("/robots.txt", { maxRedirects: 0 });
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain("Disallow: /");
    const headers = (await request.get("/")).headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  test("the offline page is shown when a page can't load", async ({ page, context }) => {
    await page.goto("/");
    const registered = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((r) => setTimeout(() => r(null), 5000)),
      ]);
      return !!reg;
    });
    // The service worker only registers in production builds.
    test.skip(!registered, "service worker not registered (dev server)");
    await context.setOffline(true);
    await page.goto("/privacy").catch(() => {});
    await expect(page.getByRole("heading", { level: 1, name: "You're offline" })).toBeVisible();
    await context.setOffline(false);
  });
});
