import { expect, test } from "@playwright/test";

test("renders the repository foundation", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Le socle est prêt." }),
  ).toBeVisible();
});
