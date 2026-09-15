import { expect, test, type Page, type Route } from "@playwright/test";

const administrator = {
  email: "administrator.auth@wanzila.test",
  password: "Correct-Horse-Battery-7!",
};

const pharmacy = {
  id: "00000000-0000-4000-8000-000000009501",
  name: "Pharmacie Nouvelle",
  address: {
    line: "42 avenue de la Paix",
    district: "Plateau",
    arrondissement: "Poto-Poto",
  },
  phone: "+242060009999",
  coordinates: { latitude: -4.263708, longitude: 15.242885 },
  status: "DRAFT",
  createdAt: "2026-09-15T12:00:00.000Z",
  updatedAt: "2026-09-15T12:00:00.000Z",
};

type AdminApiState = {
  signedIn: boolean;
  dutyEligible: boolean;
  pharmacy: typeof pharmacy;
  createRequests: number;
  listMode?: "empty" | "forbidden" | "server-error";
  createMode?: "validation" | "conflict";
};

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockAdminApi(page: Page, state: AdminApiState): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const isMutation = ["POST", "PATCH"].includes(request.method());
    const authenticationError = {
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required",
      },
    };

    if (pathname === "/api/v1/admin/auth/sign-in") {
      state.signedIn = true;
      await fulfillJson(route, 200, {
        data: {
          administrator: {
            id: "00000000-0000-4000-8000-000000009500",
            email: administrator.email,
            displayName: "Administratrice Wanzila",
          },
          expiresAt: "2026-09-16T00:00:00.000Z",
        },
      });
      return;
    }

    if (pathname === "/api/v1/admin/auth/sign-out") {
      state.signedIn = false;
      await fulfillJson(route, 200, { data: { signedOut: true } });
      return;
    }

    if (pathname === "/api/v1/admin/auth/session") {
      if (!state.signedIn) {
        await fulfillJson(route, 401, authenticationError);
        return;
      }
      await fulfillJson(route, 200, {
        data: {
          administrator: {
            id: "00000000-0000-4000-8000-000000009500",
            email: administrator.email,
            displayName: "Administratrice Wanzila",
          },
          expiresAt: "2026-09-16T00:00:00.000Z",
        },
      });
      return;
    }

    if (pathname.startsWith("/api/v1/admin/") && !state.signedIn) {
      await fulfillJson(route, 401, authenticationError);
      return;
    }

    if (isMutation && pathname.startsWith("/api/v1/admin/")) {
      if (!request.headers().origin) {
        await fulfillJson(route, 403, {
          error: {
            code: "ORIGIN_FORBIDDEN",
            message: "Request origin is not allowed",
          },
        });
        return;
      }
    }

    if (pathname === "/api/v1/admin/pharmacies" && request.method() === "GET") {
      if (state.listMode === "forbidden") {
        await fulfillJson(route, 403, {
          error: { code: "ORIGIN_FORBIDDEN", message: "Access is forbidden" },
        });
        return;
      }
      if (state.listMode === "server-error") {
        await fulfillJson(route, 500, {
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
        return;
      }
      const data = state.listMode === "empty" ? [] : [state.pharmacy];
      await fulfillJson(route, 200, {
        data,
        pagination: {
          page: 1,
          pageSize: 20,
          total: data.length,
          totalPages: 1,
        },
      });
      return;
    }

    if (
      pathname === "/api/v1/admin/pharmacies" &&
      request.method() === "POST"
    ) {
      state.createRequests += 1;
      if (state.createMode === "validation") {
        await fulfillJson(route, 400, {
          error: { code: "BAD_REQUEST", message: "Invalid request parameters" },
        });
        return;
      }
      if (state.createMode === "conflict") {
        await fulfillJson(route, 409, {
          error: {
            code: "CONFLICT",
            message: "A matching pharmacy already exists",
          },
        });
        return;
      }
      state.pharmacy = { ...state.pharmacy, status: "DRAFT" };
      await fulfillJson(route, 201, { data: state.pharmacy });
      return;
    }

    if (pathname === `/api/v1/admin/pharmacies/${state.pharmacy.id}`) {
      if (request.method() === "PATCH") {
        state.pharmacy = {
          ...state.pharmacy,
          ...(request.postDataJSON() as Partial<typeof pharmacy>),
        };
      }
      await fulfillJson(route, 200, { data: state.pharmacy });
      return;
    }

    if (pathname === `/api/v1/admin/pharmacies/${state.pharmacy.id}/publish`) {
      state.pharmacy = { ...state.pharmacy, status: "PUBLISHED" };
      state.dutyEligible = true;
      await fulfillJson(route, 200, { data: state.pharmacy });
      return;
    }

    if (pathname === `/api/v1/admin/pharmacies/${state.pharmacy.id}/archive`) {
      state.pharmacy = { ...state.pharmacy, status: "ARCHIVED" };
      await fulfillJson(route, 200, { data: state.pharmacy });
      return;
    }

    if (pathname === "/api/v1/pharmacies") {
      const data =
        state.pharmacy.status === "PUBLISHED" && state.dutyEligible
          ? [
              {
                ...state.pharmacy,
                currentDuty: {
                  state: "ACTIVE",
                  startsAt: "2026-09-15T08:00:00.000Z",
                  endsAt: "2026-09-15T20:00:00.000Z",
                  sourceFreshness: "UNKNOWN",
                },
              },
            ]
          : [];
      await fulfillJson(route, 200, {
        data,
        pagination: {
          page: 1,
          pageSize: 20,
          total: data.length,
          totalPages: 1,
        },
      });
      return;
    }

    await route.fallback();
  });
}

function newState(): AdminApiState {
  return {
    signedIn: false,
    dutyEligible: false,
    pharmacy: { ...pharmacy, address: { ...pharmacy.address } },
    createRequests: 0,
  };
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/admin/connexion");
  await page.getByLabel("Adresse e-mail").fill(administrator.email);
  await page.getByLabel("Mot de passe").fill(administrator.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin\/pharmacies$/);
}

async function fillPharmacyForm(page: Page): Promise<void> {
  await page.getByLabel("Nom de la pharmacie").fill(pharmacy.name);
  await page.getByLabel("Adresse").fill(pharmacy.address.line);
  await page.getByLabel("District").fill(pharmacy.address.district);
  await page.getByLabel("Arrondissement").fill(pharmacy.address.arrondissement);
  await page.getByLabel("Téléphone").fill(pharmacy.phone);
  await page.getByLabel("Latitude").fill(String(pharmacy.coordinates.latitude));
  await page
    .getByLabel("Longitude")
    .fill(String(pharmacy.coordinates.longitude));
}

test("redirects anonymous administration to the accessible sign-in surface and revokes access on sign-out", async ({
  page,
}) => {
  await mockAdminApi(page, newState());
  await page.goto("/admin/pharmacies");
  await expect(page).toHaveURL(/\/admin\/connexion$/);
  await expect(
    page.getByRole("heading", { name: "Connexion administrateur" }),
  ).toBeVisible();
  await expect(page.getByLabel("Adresse e-mail")).toBeVisible();
  await expect(page.getByLabel("Mot de passe")).toBeVisible();

  await signIn(page);
  await expect(page.getByRole("heading", { name: "Pharmacies" })).toBeVisible();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/admin\/connexion$/);
});

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 1000 },
]) {
  test(`matches the admin pharmacy references through the complete ${viewport.name} journey`, async ({
    page,
  }) => {
    const state = newState();
    await page.setViewportSize(viewport);
    await mockAdminApi(page, state);
    await signIn(page);
    await expect(
      page.getByRole("heading", { name: "Pharmacies" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ajouter une pharmacie" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Ajouter une pharmacie" }).click();
    await expect(
      page.getByRole("heading", { name: "Nouvelle pharmacie" }),
    ).toBeVisible();

    await fillPharmacyForm(page);
    const submit = page.getByRole("button", {
      name: "Enregistrer le brouillon",
    });
    await submit.dblclick();
    await expect(submit).toBeDisabled();
    await expect.poll(() => state.createRequests).toBe(1);
    await expect(
      page.getByRole("heading", { name: pharmacy.name }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Modifier" }).click();
    await page.getByLabel("Téléphone").fill("+242060001234");
    await page
      .getByRole("button", { name: "Enregistrer les modifications" })
      .click();
    await expect(page.getByText("+242060001234")).toBeVisible();

    await page.getByRole("button", { name: "Publier" }).click();
    await expect(page.getByText("Publiée")).toBeVisible();
    await page.goto("/");
    await expect(page.getByText(pharmacy.name)).toBeVisible();

    await page.goto(`/admin/pharmacies/${pharmacy.id}`);
    const archive = page.getByRole("button", { name: "Archiver" });
    await archive.focus();
    await archive.press("Enter");
    const confirmation = page.getByRole("alertdialog", {
      name: "Archiver cette pharmacie ?",
    });
    await expect(confirmation).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(confirmation).toBeHidden();
    await expect(archive).toBeFocused();
    await archive.press("Enter");
    await confirmation.getByRole("button", { name: "Archiver" }).click();

    await page.goto("/");
    await expect(page.getByText(pharmacy.name)).toBeHidden();
  });
}

test("renders loading, empty, forbidden, validation, conflict, and server errors accessibly", async ({
  page,
}) => {
  const state = newState();
  await mockAdminApi(page, state);
  state.signedIn = true;

  await page.goto("/admin/pharmacies");
  await expect(
    page.getByRole("status", { name: "Chargement des pharmacies" }),
  ).toBeVisible();

  state.listMode = "empty";
  await page.reload();
  await expect(page.getByText("Aucune pharmacie à afficher")).toBeVisible();

  state.listMode = "forbidden";
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("autorisation");

  state.listMode = "server-error";
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("réessayer");

  state.listMode = undefined;
  state.createMode = "validation";
  await page.goto("/admin/pharmacies/nouvelle");
  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await expect(page.getByRole("alert")).toContainText("Corrigez les champs");
  await expect(page.getByLabel("Nom de la pharmacie")).toHaveAttribute(
    "aria-invalid",
    "true",
  );

  state.createMode = "conflict";
  await fillPharmacyForm(page);
  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await expect(page.getByRole("alert")).toContainText("existe déjà");
});
