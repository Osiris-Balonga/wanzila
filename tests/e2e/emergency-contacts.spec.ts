import { expect, test, type Page } from "@playwright/test";

// The public shell and mobile-navigation.png define the navigation language.
// The emergency-contact page body is intentionally derived from US14: no
// pixel-identical body mockup exists.
const viewports = [
  { name: "320", width: 320, height: 800 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 1000 },
];

const emergencyResponse = {
  data: [
    {
      id: "00000000-0000-4000-8000-000000001401",
      label: "SAMU",
      phone: "112",
      position: 1,
      updatedAt: "2026-09-15T08:30:45.123Z",
    },
  ],
};

async function mockEmergencyContacts(page: Page): Promise<void> {
  await page.route("**/api/v1/emergency-contacts", async (route) => {
    await route.fulfill({ json: emergencyResponse });
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const documentWidth = await page.locator("html").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));

  expect(documentWidth.scrollWidth).toBe(documentWidth.clientWidth);
}

for (const viewport of viewports) {
  test(`emergency contacts remain accessible at ${viewport.name}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await mockEmergencyContacts(page);
    await page.goto("/urgences");

    await expect(
      page.getByRole("heading", { name: "Contacts d’urgence" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Navigation publique" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Urgences" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("link", { name: "Enregistrés" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("link", { name: "Accueil" })).toHaveAttribute(
      "href",
      "/",
    );
    await expect(
      page.getByRole("link", { name: "Contribuer" }),
    ).toHaveAttribute("href", "/contribuer");
    await expect(
      page.getByRole("link", { name: "Appeler SAMU au 112" }),
    ).toHaveAttribute("href", "tel:112");
    await expect(page.getByText("Mis à jour le")).toBeVisible();
    await expect(
      page.getByText(/ne remplace pas.*services d’urgence/i),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

test("emergency call controls have a keyboard name, focus, and touch target", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await mockEmergencyContacts(page);
  await page.goto("/urgences");
  const callAction = page.getByRole("link", { name: "Appeler SAMU au 112" });

  await expect(callAction).toBeVisible();
  await callAction.focus();
  await expect(callAction).toBeFocused();
  await expect(callAction).toHaveAttribute("href", "tel:112");
  const bounds = await callAction.boundingBox();

  expect(bounds).not.toBeNull();
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
});
