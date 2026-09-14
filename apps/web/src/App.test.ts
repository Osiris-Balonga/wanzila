import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { isAdminPath } from "./App";
import { Button } from "./components/ui/button";
import { Dialog, DialogFooter } from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Switch } from "./components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs";

describe("route shell selection", () => {
  it("reserves the administration shell for administration routes", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/pharmacies")).toBe(true);
    expect(isAdminPath("/contribuer")).toBe(false);
  });
});

describe("accessible shadcn primitives", () => {
  it("preserves disabled and busy button states", () => {
    const markup = renderToStaticMarkup(
      createElement(Button, {
        "aria-busy": true,
        children: "Continuer",
        disabled: true,
      }),
    );
    expect(markup).toContain("disabled");
    expect(markup).toContain('aria-busy="true"');
  });

  it("associates an input with its accessible label and error state", () => {
    const markup = renderToStaticMarkup(
      createElement("div", undefined, [
        createElement(Label, { htmlFor: "name", key: "label" }, "Nom"),
        createElement(Input, {
          "aria-invalid": true,
          id: "name",
          key: "input",
        }),
      ]),
    );
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('for="name"');
  });

  it("exposes the checked state of a switch", () => {
    const markup = renderToStaticMarkup(
      createElement(Switch, {
        "aria-label": "Notifications",
        checked: true,
      }),
    );
    expect(markup).toContain('role="switch"');
    expect(markup).toContain('aria-checked="true"');
  });

  it("renders Radix tabs with selected state and keyboard semantics", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Tabs,
        { value: "overview" },
        createElement(
          TabsList,
          { "aria-label": "Sections" },
          createElement(TabsTrigger, { value: "overview" }, "Vue d’ensemble"),
        ),
      ),
    );

    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('role="tab"');
    expect(markup).toContain('aria-selected="true"');
  });

  it("uses a French and overridable Dialog close label", () => {
    const defaultMarkup = renderToStaticMarkup(
      createElement(
        Dialog,
        { open: true },
        createElement(DialogFooter, { showCloseButton: true }),
      ),
    );
    const customMarkup = renderToStaticMarkup(
      createElement(
        Dialog,
        { open: true },
        createElement(DialogFooter, {
          closeLabel: "Annuler",
          showCloseButton: true,
        }),
      ),
    );

    expect(defaultMarkup).toContain(">Fermer<");
    expect(customMarkup).toContain(">Annuler<");
  });
});
