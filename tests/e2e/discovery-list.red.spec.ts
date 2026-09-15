import { expect, test, type Page } from "@playwright/test";

const pharmacyId = "00000000-0000-4000-8000-000000000006";
const viewports = [
  { name: "320", width: 320, height: 800 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 1000 },
];

const pharmacyListResponse = {
  data: [
    {
      id: pharmacyId,
      name: "Pharmacie Centrale",
      address: {
        line: "12 avenue de la Paix",
        district: "Plateau",
        arrondissement: "Poto-Poto",
      },
      coordinates: { latitude: -4.2634, longitude: 15.2429 },
      currentDuty: {
        state: "ACTIVE",
        startsAt: "2026-09-15T08:00:00.000Z",
        endsAt: "2026-09-16T08:00:00.000Z",
        sourceFreshness: "FRESH",
        source: {
          name: "Ordre national des pharmaciens",
          observedAt: "2026-09-15T08:30:00.000Z",
        },
      },
    },
  ],
  pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
};

async function mockPharmacyList(page: Page): Promise<void> {
  await page.route("**/api/v1/pharmacies?**", async (route) => {
    await route.fulfill({ json: pharmacyListResponse });
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.locator("html").evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      })),
    )
    .toEqual({
      clientWidth: await page
        .locator("html")
        .evaluate((element) => element.clientWidth),
      scrollWidth: await page
        .locator("html")
        .evaluate((element) => element.clientWidth),
    });
}

for (const viewport of viewports) {
  test(`discovery list remains usable at ${viewport.name}px without a map`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await mockPharmacyList(page);
    await page.goto("/?q=Centrale&district=Plateau&arrondissement=Poto-Poto");

    await expect(
      page.getByRole("heading", { name: "Pharmacies de garde" }),
    ).toBeVisible();
    await expect(
      page.getByRole("searchbox", {
        name: "Rechercher une pharmacie, un quartier",
      }),
    ).toHaveValue("Centrale");
    await expect(page.getByLabel("Quartier")).toHaveValue("Plateau");
    await expect(page.getByLabel("Arrondissement")).toHaveValue("Poto-Poto");
    await expect(
      page.getByRole("list", { name: "Résultats de pharmacies de garde" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Pharmacie Centrale/ }),
    ).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
}

test("search URL state is shareable, restored through navigation, and keyboard focus stays visible", async ({
  page,
}) => {
  await mockPharmacyList(page);
  await page.goto("/?q=Alpha");
  const search = page.getByRole("searchbox", {
    name: "Rechercher une pharmacie, un quartier",
  });

  await expect(search).toHaveValue("Alpha");
  await search.fill("Centrale");
  await search.press("Enter");
  await expect(page).toHaveURL(/\?q=Centrale/);
  await page.goBack();
  await expect(search).toHaveValue("Alpha");

  await search.focus();
  await expect(search).toBeFocused();
  await expect(search).toHaveCSS("outline-style", "solid");
});
