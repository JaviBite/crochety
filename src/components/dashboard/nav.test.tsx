// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import es from "../../../messages/es.json";

let pathname = "/dashboard";

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => pathname,
  Link: ({ href, children, ...props }: ComponentProps<"a">) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}));

import { DashboardNav } from "./nav";

function renderNav(currentPath: string, isAdmin = false) {
  pathname = currentPath;
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <DashboardNav isAdmin={isAdmin} />
    </NextIntlClientProvider>,
  );
}

describe("DashboardNav", () => {
  it("marca Inicio como activo solo en /dashboard exacto", () => {
    renderNav("/dashboard");
    expect(screen.getByRole("link", { name: /Inicio/ })).toHaveClass("bg-accent");
    expect(screen.getByRole("link", { name: /Pedidos/ })).not.toHaveClass(
      "bg-accent",
    );
  });

  it("marca la sección activa también en sus subrutas", () => {
    renderNav("/dashboard/pedidos/123");
    expect(screen.getByRole("link", { name: /Pedidos/ })).toHaveClass(
      "bg-accent",
    );
    // Inicio no debe activarse en subrutas de otras secciones.
    expect(screen.getByRole("link", { name: /Inicio/ })).not.toHaveClass(
      "bg-accent",
    );
  });

  it("muestra las cinco secciones traducidas", () => {
    renderNav("/dashboard");
    for (const label of ["Inicio", "Pedidos", "Gastos", "Materiales", "Patrones"]) {
      expect(screen.getByRole("link", { name: new RegExp(label) })).toBeVisible();
    }
  });

  it("muestra Perfil a todo el mundo pero oculta Usuarios y Ajustes sin rol admin", () => {
    renderNav("/dashboard");
    expect(screen.getByRole("link", { name: /Perfil/ })).toBeVisible();
    expect(screen.queryByRole("link", { name: /Usuarios/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Ajustes/ })).toBeNull();
  });

  it("muestra Usuarios y Ajustes a los admin", () => {
    renderNav("/dashboard", true);
    expect(screen.getByRole("link", { name: /Usuarios/ })).toBeVisible();
    expect(screen.getByRole("link", { name: /Ajustes/ })).toBeVisible();
  });
});
