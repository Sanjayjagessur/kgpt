import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { onboard, signIn } from "./helpers/flows";
import { adminClient, createTestStudent, deleteTestStudent } from "./helpers/supabase";

test.skip(!adminClient(), "Supabase keys are not configured");

let student: { id: string; email: string; password: string } | null = null;

test.beforeEach(async ({ page }, testInfo) => {
  student = await createTestStudent(`chat-${testInfo.project.name}`);
  await signIn(page, student!);
  await onboard(page);
});

test.afterEach(async () => {
  if (student) await deleteTestStudent(student.id);
});

/** Seeds a chat with one exchange directly in the database (no AI call). */
async function seedChat(title: string, question: string, answer: string) {
  const admin = adminClient()!;
  const { data: chat } = await admin
    .from("chats")
    .insert({ user_id: student!.id, title, subject_id: "mathematics" })
    .select("id")
    .single();
  await admin.from("chat_messages").insert([
    { chat_id: chat!.id, user_id: student!.id, role: "user", content: question },
    { chat_id: chat!.id, user_id: student!.id, role: "assistant", content: answer },
  ]);
  return chat!.id as string;
}

/** On phones the history lives in a sheet. */
async function openHistory(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole("button", { name: "History" }).click();
  return page.getByRole("navigation", { name: "History" }).last();
}

test("new chat shows suggestions, modes and the equation builder", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.getByRole("heading", { level: 1, name: "Ask your tutor" })).toBeVisible();

  // A suggestion fills the box and switches mode.
  await page.getByRole("button", { name: /Get unstuck on homework/ }).click();
  const input = page.getByRole("textbox", { name: "Message the tutor" });
  await expect(input).toHaveValue("I'm stuck on this question: ");
  await expect(input).toBeFocused();
  await expect(page.getByRole("combobox", { name: "Tutor mode" })).toHaveText(/Homework help/);

  // fx: build an equation and insert it as $...$.
  await page.getByRole("button", { name: "Insert an equation" }).click();
  await page.getByRole("button", { name: "frac{a}{b}" }).click();
  await page.keyboard.type("1");
  await page.getByRole("button", { name: "Insert equation" }).click();
  await expect(input).toHaveValue("I'm stuck on this question: $\\frac{1}{}$");

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id} (${v.nodes[0]?.target})`)).toEqual([]);
});

test("a streamed reply appears and the chat joins the history", async ({ page, isMobile }) => {
  // The AI call is replaced by a canned stream; the real route is covered by the API tests below.
  const chatId = "11111111-2222-4333-8444-555555555555";
  await page.route("/api/chat", async (route) => {
    const events = [
      { t: "start", chatId, userMessageId: 1 },
      { t: "delta", text: "The answer is " },
      { t: "delta", text: "$x = 4$." },
      { t: "title", title: "Solving a linear equation" },
      { t: "done", messageId: 2 },
    ];
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: events.map((e) => JSON.stringify(e)).join("\n") + "\n",
    });
  });

  await page.goto("/chat");
  await page.getByRole("textbox", { name: "Message the tutor" }).fill("Solve 2x + 1 = 9");
  await page.keyboard.press("Enter");

  const conversation = page.getByRole("region", { name: "Conversation" });
  await expect(conversation.getByText("Solve 2x + 1 = 9")).toBeVisible();
  await expect(conversation.locator(".katex")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/chat/${chatId}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Solving a linear equation");
  await expect(conversation.getByRole("button", { name: "Explain differently" })).toBeVisible();

  const history = await openHistory(page, isMobile);
  await expect(history.getByRole("link", { name: /Solving a linear equation/ })).toBeVisible();
});

test("rename, search, save to notes and delete a chat", async ({ page, isMobile }) => {
  const chatId = await seedChat("Quadratics", "How do I factorise x^2 + 5x + 6?", "Find two numbers that multiply to 6 and add to 5.");
  await page.goto(`/chat/${chatId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Quadratics");

  // Save the tutor reply to notes.
  await page.getByRole("button", { name: "Save to notes" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  const { data: notes } = await adminClient()!.from("notes").select("body").eq("user_id", student!.id);
  expect(notes?.map((n) => n.body)).toEqual(["Find two numbers that multiply to 6 and add to 5."]);

  // Search matches message text, not just titles.
  let history = await openHistory(page, isMobile);
  await page.getByRole("searchbox", { name: "Search chats" }).last().fill("multiply");
  await expect(history.getByRole("link", { name: /Quadratics/ })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search chats" }).last().fill("photosynthesis");
  await expect(history.getByText(/No chats match/)).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).last().click();

  // Rename.
  await history.getByRole("button", { name: "Options for Quadratics" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await page.getByRole("textbox", { name: "Chat name" }).fill("Factorising quadratics");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(history.getByRole("link", { name: /Factorising quadratics/ })).toBeVisible();
  if (isMobile) await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Factorising quadratics");

  // Delete.
  history = await openHistory(page, isMobile);
  await history.getByRole("button", { name: "Options for Factorising quadratics" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete chat" }).click();
  await expect(page).toHaveURL(/\/chat$/);
  const { data: left } = await adminClient()!.from("chats").select("id").eq("id", chatId);
  expect(left).toEqual([]);
});

test("another student's chat is not found", async ({ page }) => {
  const other = await createTestStudent("chat-other");
  try {
    const { data: chat } = await adminClient()!
      .from("chats")
      .insert({ user_id: other!.id, title: "Private" })
      .select("id")
      .single();
    await page.goto(`/chat/${chat!.id}`);
    await expect(page.getByRole("heading", { name: "We can't find that page" })).toBeVisible();
  } finally {
    await deleteTestStudent(other!.id);
  }
});

test("the chat API rejects bad requests", async ({ page, request }) => {
  const signedOut = await request.post("/api/chat", { data: {} });
  expect(signedOut.status()).toBe(401);

  // Signed in (the page context carries the session cookie).
  const invalid = await page.request.post("/api/chat", {
    data: { chatId: null, subjectId: null, mode: "auto", text: "", attachments: [] },
  });
  expect(invalid.status()).toBe(400);

  const foreignFile = await page.request.post("/api/chat", {
    data: {
      chatId: null,
      subjectId: null,
      mode: "auto",
      text: "What is in this photo?",
      attachments: [
        { path: "00000000-0000-4000-8000-000000000000/00000000-0000-4000-8000-000000000001.png", name: "x.png", type: "image/png" },
      ],
    },
  });
  expect(foreignFile.status()).toBe(400);
});

// One real round trip to Claude. Opt in with E2E_AI=1 (it costs a request).
test("the tutor answers for real", async ({ page, isMobile }) => {
  test.skip(!process.env.E2E_AI || isMobile, "set E2E_AI=1 to call the AI");
  test.setTimeout(120_000);
  await page.goto("/chat");
  await page.getByRole("textbox", { name: "Message the tutor" }).fill("In one sentence, what is a prime number?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const reply = page.getByRole("region", { name: "Conversation" }).locator("ol > li").nth(1);
  await expect(reply.getByRole("button", { name: "Copy" })).toBeVisible({ timeout: 90_000 });
  await expect(reply).toContainText(/divis|factor/i);
});
