import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Sin `globals: true`, Testing Library no registra su auto-cleanup: se hace
// aquí para que cada test parta de un DOM vacío.
afterEach(() => {
  cleanup();
});
