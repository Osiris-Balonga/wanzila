import { expect, test } from "@playwright/test";

const viewports = [
  { name: "320", width: 320, height: 800 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 1000 },
];

for (const viewport of viewports) {
  test(`public shell is usable at ${viewport.name}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator("body")).toHaveJSProperty(
      "scrollWidth",
      viewport.width,
    );
    await expect(
      page.getByRole("navigation", { name: "Navigation publique" }),
    ).toBeVisible();
  });
}

for (const viewport of viewports) {
  test(`admin shell is usable at ${viewport.name}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/admin");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator("body")).toHaveJSProperty(
      "scrollWidth",
      viewport.width,
    );

    if (viewport.width < 768) {
      await page.locator("summary").click();
    }

    await expect(
      page.getByRole("navigation", { name: "Navigation administration" }),
    ).toBeVisible();
  });
}

test("keyboard focus remains visible on shell navigation", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Aller au contenu" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Pharma Garde, accueil" }),
  ).toBeFocused();
});

test("the narrow administration navigation opens from the keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/admin");
  await page.locator("summary").focus();
  await page.locator("summary").press("Enter");
  await expect(
    page.getByRole("navigation", { name: "Navigation administration" }),
  ).toBeVisible();
});
