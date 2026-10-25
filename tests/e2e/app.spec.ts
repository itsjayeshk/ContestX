import { expect, test, type Page } from "@playwright/test";

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  return errors;
}

test("landing page answers 'what is next and when'", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Never miss");
  await expect(page.getByText("Next contest").first()).toBeVisible();
  await expect(page.getByRole("timer").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore Contests" })).toHaveAttribute("href", "/contests");
  expect(errors).toEqual([]);
});

test("every navigation link resolves", async ({ page }) => {
  for (const path of ["/dashboard", "/contests", "/calendar", "/analytics", "/reminders", "/settings", "/login", "/register"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
  }
  // Guests get the not-found page for /admin. (Status can be 200 because the response is streamed.)
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "This page doesn't exist." })).toBeVisible();
  await expect(page.getByText("Provider health")).toHaveCount(0);
});

test("contest explorer filters, searches and switches layout", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/contests");
  await page.getByLabel("Search contests by name").fill("E2E Fixture");
  await expect(page.getByRole("link", { name: "Sample E2E Fixture Round" })).toBeVisible();
  await expect(page).toHaveURL(/q=E2E/);
  await page.getByRole("button", { name: "LeetCode" }).click();
  await expect(page.getByText("Nothing matches these filters")).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await page.getByRole("radio", { name: "Grid" }).click();
  await expect(page.getByRole("article").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("guests are told reminders need an account", async ({ page }) => {
  await page.goto("/reminders");
  await expect(page.getByText("Reminders need an account")).toBeVisible();
  await page.goto("/contests?q=E2E");
  await page.getByRole("button", { name: /Save Sample E2E Fixture Round/ }).click();
  await expect(page.getByText("Sign in to save contests")).toBeVisible();
});

test("register, set reminder defaults, and see scheduled reminders", async ({ page }) => {
  const errors = trackErrors(page);
  const email = `e2e-${Date.now()}@example.test`;
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-long-test-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/settings/);

  // Choose 24h + 1h + 15m and save.
  await page.getByRole("button", { name: "24 hours before" }).click();
  await page.getByRole("button", { name: "Save reminder settings" }).click();
  await expect(page.getByText("Reminder settings saved")).toBeVisible();

  await page.goto("/reminders");
  const row = page.getByRole("listitem").filter({ hasText: "Sample E2E Fixture Round" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("1d before");
  await expect(row).toContainText("1h before");

  // Exclude this contest; its reminders disappear.
  await row.getByRole("button", { name: /Cancel reminders/ }).click();
  await expect(page.getByText("Reminders cancelled for this contest")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Sample E2E Fixture Round" })).toHaveCount(0);

  // Bookmark from the explorer and see it under saved contests.
  await page.goto("/contests?q=E2E");
  await page.getByRole("button", { name: /Save Sample E2E Fixture Round/ }).click();
  await expect(page.getByText("Contest saved")).toBeVisible();
  await page.goto("/reminders");
  await expect(page.getByRole("region", { name: /Saved contests/ }).getByText("Sample E2E Fixture Round")).toBeVisible();
  expect(errors).toEqual([]);
});

test("calendar switches views and opens the detail panel", async ({ page }) => {
  await page.goto("/calendar");
  await page.getByRole("radio", { name: "Agenda" }).click();
  await page.getByRole("button", { name: /Sample E2E Fixture Round/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Sample E2E Fixture Round" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: /Open on Codeforces/ })).toHaveAttribute("href", "https://codeforces.com/contests");
  await page.keyboard.press("Escape");
  await page.getByRole("radio", { name: "Week" }).click();
  await page.getByRole("radio", { name: "Month" }).click();
  await expect(page.getByRole("grid")).toBeVisible();
});

test("search dialog opens with Ctrl+K", async ({ page }) => {
  await page.goto("/dashboard");
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Find a contest").fill("Fixture");
  await expect(page.getByRole("option", { name: /Sample E2E Fixture Round/ })).toBeVisible();
});

test("health endpoint reports database status", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.database).toBe("ok");
  expect(body.providers).toHaveLength(3);
});
