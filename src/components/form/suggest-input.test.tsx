// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SuggestInput } from "./suggest-input";

describe("SuggestInput", () => {
  it("asocia el datalist con las opciones al input", () => {
    render(<SuggestInput options={["Hobbycraft", "Amazon"]} aria-label="tienda" />);
    const input = screen.getByLabelText("tienda");
    const listId = input.getAttribute("list");
    expect(listId).toBeTruthy();
    const datalist = document.getElementById(listId!);
    expect(datalist?.tagName).toBe("DATALIST");
    // <option value="…"> no tiene textContent: se comprueba el atributo.
    const values = [...datalist!.querySelectorAll("option")].map(
      (option) => option.getAttribute("value"),
    );
    expect(values).toEqual(["Hobbycraft", "Amazon"]);
  });

  it("sin opciones no añade datalist ni atributo list", () => {
    render(<SuggestInput aria-label="tienda" />);
    expect(screen.getByLabelText("tienda")).not.toHaveAttribute("list");
    expect(document.querySelector("datalist")).toBeNull();
  });
});
