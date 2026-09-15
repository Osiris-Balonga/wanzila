import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { authenticationErrorSchema } from "./support/admin-auth-contract.js";

describe("administrator authentication routes without persistence", () => {
  const applications: Awaited<ReturnType<typeof createApp>>[] = [];

  afterEach(async () => {
    await Promise.all(applications.splice(0).map((app) => app.close()));
  });

  it("rejects an anonymous session request with the public authentication envelope", async () => {
    const app = await createApp({ webOrigin: "http://localhost:5173" });
    applications.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/auth/session",
    });

    expect(response.statusCode).toBe(401);
    expect(authenticationErrorSchema.parse(response.json())).toEqual({
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required",
      },
    });
  });

  it("strictly rejects an invalid sign-in body before it can access persistence", async () => {
    const app = await createApp({ webOrigin: "http://localhost:5173" });
    applications.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/auth/sign-in",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
      },
      payload: {
        email: "administrator@wanzila.test",
        password: "correct-but-irrelevant",
        unexpected: true,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(authenticationErrorSchema.parse(response.json())).toEqual({
      error: { code: "BAD_REQUEST", message: "Invalid request parameters" },
    });
  });
});
