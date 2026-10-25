import { expect, test } from "@playwright/test";

for (const path of ["/", "/dashboard", "/contests", "/calendar", "/analytics", "/settings"]) {
  test(`no horizontal overflow on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(scroll).toBeLessThanOrEqual(inner);
  });
}

test("mobile menu navigates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Calendar" }).click();
  await expect(page).toHaveURL(/\/calendar/);
  await expect(page.getByRole("radio", { name: "Agenda" })).toHaveAttribute("aria-checked", "true");
});
