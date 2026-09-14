import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { isAdminPath } from "./App";
import { Button, Field, Switch } from "./components/primitives";

describe("route shell selection", () => {
  it("reserves the administration shell for administration routes", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/pharmacies")).toBe(true);
    expect(isAdminPath("/contribuer")).toBe(false);
  });
});

describe("accessible primitives", () => {
  it("disables and announces a loading button", () => {
    const markup = renderToStaticMarkup(
      createElement(Button, { loading: true, children: "Continuer" }),
    );
    expect(markup).toContain("disabled");
    expect(markup).toContain('aria-busy="true"');
  });

  it("associates the field label and its error description", () => {
    const markup = renderToStaticMarkup(
      createElement(Field, { error: "Le champ est requis", label: "Nom" }),
    );
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain("Le champ est requis");
  });

  it("exposes the checked state of a switch", () => {
    const markup = renderToStaticMarkup(
      createElement(Switch, { checked: true, label: "Notifications" }),
    );
    expect(markup).toContain('role="switch"');
    expect(markup).toContain('aria-checked="true"');
  });
});
