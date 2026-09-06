// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, describe, expect, it } from "vitest";
import es from "../../../messages/es.json";
import { ComboboxField, filterComboboxOptions } from "./combobox-field";

const options = [
  { value: "m1", label: "Lana algodón rosa" },
  { value: "m2", label: "Lana velvet azul" },
  { value: "m3", label: "Ojos 9mm" },
];

beforeAll(() => {
  // Radix popper usa ResizeObserver para posicionar; jsdom no lo implementa.
  Object.defineProperty(globalThis, "ResizeObserver", {
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    configurable: true,
  });
});

function renderCombobox(
  props?: Partial<React.ComponentProps<typeof ComboboxField>>,
) {
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <ComboboxField name="materialId" options={options} {...props} />
    </NextIntlClientProvider>,
  );
}

describe("filterComboboxOptions", () => {
  it("filtra por subcadena case-insensitive en label y value", () => {
    expect(filterComboboxOptions(options, "velvet")).toEqual([options[1]]);
    expect(filterComboboxOptions(options, "M3")).toEqual([options[2]]);
    expect(filterComboboxOptions(options, "  lana  ")).toHaveLength(2);
  });

  it("sin query devuelve la lista intacta", () => {
    expect(filterComboboxOptions(options, "")).toBe(options);
  });
});

describe("ComboboxField", () => {
  it("viaja en un input hidden con el valor inicial", () => {
    renderCombobox({ defaultValue: "m2" });
    expect(
      document.querySelector('input[type="hidden"][name="materialId"]'),
    ).toHaveValue("m2");
    expect(screen.getByRole("button")).toHaveTextContent("Lana velvet azul");
  });

  it("muestra el placeholder cuando no hay selección", () => {
    renderCombobox({ placeholder: "Elige un material…" });
    expect(screen.getByRole("button")).toHaveTextContent("Elige un material…");
    expect(
      document.querySelector('input[type="hidden"][name="materialId"]'),
    ).toHaveValue("");
  });

  it("abre, filtra y selecciona con el teclado", async () => {
    const user = userEvent.setup();
    renderCombobox({ placeholder: "Elige…" });
    await user.click(screen.getByRole("button"));
    const search = screen.getByRole("combobox");
    await user.type(search, "velvet");
    // El filtrado deja una sola opción ya resaltada: Enter selecciona.
    await user.keyboard("{Enter}");
    expect(
      document.querySelector('input[type="hidden"][name="materialId"]'),
    ).toHaveValue("m2");
    // El popover se cierra tras seleccionar.
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("muestra 'Sin resultados' con una query sin coincidencias", async () => {
    const user = userEvent.setup();
    renderCombobox();
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByRole("combobox"), "zzz");
    expect(screen.getByText("Sin resultados")).toBeVisible();
  });

  it("con allowClear deselecciona desde el propio trigger", async () => {
    const user = userEvent.setup();
    renderCombobox({ defaultValue: "m1", allowClear: true });
    await user.click(screen.getByRole("button", { name: /Quitar selección/ }));
    expect(
      document.querySelector('input[type="hidden"][name="materialId"]'),
    ).toHaveValue("");
  });
});
