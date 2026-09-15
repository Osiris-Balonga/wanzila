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

type PharmacyMockOptions = {
  totalPages?: number;
  onRequest?: (url: URL) => void;
};

async function mockPharmacyList(
  page: Page,
  options: PharmacyMockOptions = {},
): Promise<void> {
  await page.route("**/api/v1/pharmacies?**", async (route) => {
    const url = new URL(route.request().url());
    options.onRequest?.(url);
    const query = url.searchParams.get("q");

    if (query === "Erreur") {
      await route.fulfill({
        status: 503,
        json: {
          error: { code: "INTERNAL_ERROR", message: "Service indisponible" },
        },
      });
      return;
    }

    if (query === "Inconnue") {
      await route.fulfill({
        json: {
          data: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        },
      });
      return;
    }

    const totalPages = options.totalPages ?? 1;
    const currentPage = Number(url.searchParams.get("page") ?? "1");
    await route.fulfill({
      json: {
        ...pharmacyListResponse,
        pagination: {
          page: currentPage,
          pageSize: 20,
          total: totalPages * 20,
          totalPages,
        },
      },
    });
  });
}

type AnalyticsEvent = { name: string; properties: Record<string, unknown> };

async function captureAnalytics(page: Page): Promise<AnalyticsEvent[]> {
  const events: AnalyticsEvent[] = [];
  await page.route("**/api/v1/analytics/events", async (route) => {
    const body = route.request().postData();
    if (body) {
      const candidate: unknown = JSON.parse(body);
      if (
        typeof candidate === "object" &&
        candidate !== null &&
        "name" in candidate &&
        "properties" in candidate &&
        typeof candidate.name === "string" &&
        typeof candidate.properties === "object" &&
        candidate.properties !== null
      ) {
        events.push({
          name: candidate.name,
          properties: candidate.properties as Record<string, unknown>,
        });
      }
    }
    await route.fulfill({ status: 202, json: { data: {} } });
  });
  return events;
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
  await page.locator("body").press("Tab");
  await expect(
    page.getByRole("link", { name: "Aller au contenu" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Pharma Garde, accueil" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(search).toBeFocused();
  expect(
    await search.evaluate((element) => element.matches(":focus-visible")),
  ).toBe(true);

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Quartier")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByLabel("Quartier")).toHaveValue("Plateau");
  await page.keyboard.press("Shift+Tab");
  await expect(search).toBeFocused();

  await page.keyboard.press("Control+A");
  await page.keyboard.type("Centrale");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\?q=Centrale/);
  await page.goBack();
  await expect(search).toHaveValue("Alpha");
});

test("discovery flow emits the required analytics through the existing transport", async ({
  page,
}) => {
  const events = await captureAnalytics(page);
  await mockPharmacyList(page);
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Pharmacies de garde" }),
  ).toBeVisible();
  await expect
    .poll(
      () => events.filter((event) => event.name === "discovery_viewed").length,
    )
    .toBe(1);

  const search = page.getByRole("searchbox", {
    name: "Rechercher une pharmacie, un quartier",
  });
  await search.fill("  Inconnue  ");
  await search.press("Enter");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect
    .poll(
      () =>
        events.filter((event) => event.name === "empty_results_shown").length,
    )
    .toBe(1);
  await page.getByLabel("Quartier").selectOption("Plateau");
  await expect
    .poll(
      () => events.filter((event) => event.name === "filters_applied").length,
    )
    .toBe(1);

  await search.fill("Erreur");
  await search.press("Enter");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect
    .poll(
      () => events.filter((event) => event.name === "discovery_failed").length,
    )
    .toBe(1);

  expect(events).toContainEqual({
    name: "search_submitted",
    properties: { queryLength: 8 },
  });
  expect(events).toContainEqual({
    name: "empty_results_shown",
    properties: { queryLength: 8, resultCount: 0 },
  });
  expect(events).toContainEqual({
    name: "filters_applied",
    properties: { district: "Plateau" },
  });
  expect(events).toContainEqual({
    name: "discovery_failed",
    properties: { code: "SERVICE_UNAVAILABLE" },
  });
  expect(JSON.stringify(events)).not.toContain("Inconnue");
});

test("pagination updates the URL and #4 request, resets after a filter change, and restores through history", async ({
  page,
}) => {
  const requests: URL[] = [];
  await mockPharmacyList(page, {
    onRequest: (url) => requests.push(url),
    totalPages: 3,
  });
  await page.goto("/?page=2");

  const pagination = page.getByRole("navigation", {
    name: "Pagination des résultats",
  });
  await expect(pagination).toBeVisible();
  await pagination.getByRole("button", { name: "Page 3" }).click();
  await expect(page).toHaveURL(/\?page=3/);
  await expect
    .poll(() => requests.some((url) => url.searchParams.get("page") === "3"))
    .toBe(true);
  expect(requests.at(-1)?.searchParams.get("pageSize")).toBe("20");

  const search = page.getByRole("searchbox", {
    name: "Rechercher une pharmacie, un quartier",
  });
  await search.fill("Centrale");
  await search.press("Enter");
  await expect(page).toHaveURL(/\?q=Centrale$/);
  await expect
    .poll(() =>
      requests.some(
        (url) =>
          url.searchParams.get("q") === "Centrale" &&
          url.searchParams.get("page") === "1",
      ),
    )
    .toBe(true);

  await page.goBack();
  await expect(page).toHaveURL(/\?page=3/);
  await expect(
    pagination.getByRole("button", { name: "Page 3" }),
  ).toHaveAttribute("aria-current", "page");
});

test("retry performs a new pharmacy request and can recover from an API failure", async ({
  page,
}) => {
  let requestCount = 0;
  await page.route("**/api/v1/pharmacies?**", async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      await route.fulfill({
        status: 503,
        json: {
          error: { code: "INTERNAL_ERROR", message: "Service indisponible" },
        },
      });
      return;
    }
    await route.fulfill({ json: pharmacyListResponse });
  });
  await page.goto("/");

  const retry = page.getByRole("button", { name: "Réessayer" });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(
    page.getByRole("link", { name: /Pharmacie Centrale/ }),
  ).toBeVisible();
  expect(requestCount).toBe(2);
});
