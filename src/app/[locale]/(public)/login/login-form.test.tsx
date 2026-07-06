// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "../../../../../messages/es.json";
import { LoginForm } from "./login-form";

const signIn = vi.fn();
const push = vi.fn();
const refresh = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => searchParams,
}));

function renderForm() {
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <LoginForm />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
});

describe("LoginForm", () => {
  it("envía las credenciales y redirige al dashboard", async () => {
    signIn.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Correo electrónico"), "javier@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "secreta");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "javier@example.com",
        password: "secreta",
        redirect: false,
      });
      expect(push).toHaveBeenCalledWith("/dashboard");
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("respeta el callbackUrl del proxy (con prefijo de locale)", async () => {
    signIn.mockResolvedValue({ error: null });
    searchParams = new URLSearchParams("callbackUrl=/en/dashboard/pedidos");
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Correo electrónico"), "a@b.com");
    await user.type(screen.getByLabelText("Contraseña"), "x");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/en/dashboard/pedidos");
    });
  });

  it("ignora callbackUrl externos (open redirect)", async () => {
    signIn.mockResolvedValue({ error: null });
    searchParams = new URLSearchParams("callbackUrl=https://malicioso.example");
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Correo electrónico"), "a@b.com");
    await user.type(screen.getByLabelText("Contraseña"), "x");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("muestra el error y no redirige con credenciales incorrectas", async () => {
    signIn.mockResolvedValue({ error: "CredentialsSignin" });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Correo electrónico"), "a@b.com");
    await user.type(screen.getByLabelText("Contraseña"), "mal");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByText("Correo o contraseña incorrectos"),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    // El formulario vuelve a estar operativo para reintentar.
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });
});
