// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import es from "../../../messages/es.json";
import { TagInput } from "./tag-input";

function renderTagInput(
  props?: Partial<React.ComponentProps<typeof TagInput>>,
) {
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <TagInput {...props} />
    </NextIntlClientProvider>,
  );
}

const hiddenInput = () =>
  document.querySelector('input[type="hidden"][name="tags"]');

describe("TagInput", () => {
  it("pinta los tags iniciales como chips y viajan en el hidden input", () => {
    renderTagInput({ defaultValue: ["lana", "verde"] });
    expect(hiddenInput()).toHaveValue("lana,verde");
  });

  it("añade tags con Enter y los normaliza (mayúsculas/espacios)", async () => {
    const user = userEvent.setup();
    renderTagInput();
    const input = screen.getByPlaceholderText("Añade una etiqueta…");
    await user.type(input, "  Lana Verano  ");
    await user.keyboard("{Enter}");
    expect(hiddenInput()).toHaveValue("lana verano");
  });

  it("muestra sugerencias filtradas al escribir y añade al hacer clic", async () => {
    const user = userEvent.setup();
    renderTagInput({ suggestions: ["lana", "blanco", "velvet"] });
    await user.type(screen.getByRole("textbox"), "la");
    // "lana" y "blanco" contienen "la"; "velvet" no. Nombres exactos para no
    // confundir con los aria-label "Quitar {tag}" de los chips ya añadidos.
    expect(screen.getByRole("button", { name: "lana" })).toBeVisible();
    expect(screen.getByRole("button", { name: "blanco" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "velvet" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "lana" }));
    expect(hiddenInput()).toHaveValue("lana");
  });

  it("no sugiere nada sin texto en el input", () => {
    renderTagInput({ suggestions: ["lana"] });
    expect(screen.queryByRole("button", { name: "lana" })).toBeNull();
  });

  it("no sugiere tags ya seleccionadas", async () => {
    const user = userEvent.setup();
    renderTagInput({ defaultValue: ["lana"], suggestions: ["lana", "verde"] });
    await user.type(screen.getByRole("textbox"), "la");
    // Ojo: el chip seleccionado sigue en pantalla, pero como botón "Quitar
    // lana" (aria-label), no como sugerencia "lana".
    expect(screen.queryByRole("button", { name: "lana" })).toBeNull();
    expect(screen.getByRole("button", { name: "Quitar lana" })).toBeVisible();
  });
});
