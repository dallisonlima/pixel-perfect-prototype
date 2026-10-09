import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUsuario = vi.fn();
const criarUsuario = vi.fn();
const verificarLogin = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    getUsuario: (...args: unknown[]) => getUsuario(...args),
    criarUsuario: (...args: unknown[]) => criarUsuario(...args),
    verificarLogin: (...args: unknown[]) => verificarLogin(...args),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

import { Shell } from "@/components/Shell";

describe("acesso local", () => {
  beforeEach(() => {
    window.localStorage.clear();
    getUsuario.mockReset();
    criarUsuario.mockReset();
    verificarLogin.mockReset();
  });

  it("pede para criar o usuário no primeiro acesso e explica o uso local", async () => {
    getUsuario.mockResolvedValue(null);
    criarUsuario.mockResolvedValue(undefined);

    render(
      <Shell>
        <p>painel</p>
      </Shell>,
    );

    expect(await screen.findByRole("heading", { name: "Criar usuário local" })).toBeInTheDocument();
    expect(screen.getByText(/uso local neste computador/)).toBeInTheDocument();
    expect(screen.getByText(/não oferece proteções avançadas/)).toBeInTheDocument();
    expect(screen.getByText(/serão apagados/)).toBeInTheDocument();
    expect(screen.queryByText("painel")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Usuário"), { target: { value: "ana" } });
    fireEvent.change(screen.getByPlaceholderText("Senha"), { target: { value: "segredo" } });
    fireEvent.change(screen.getByPlaceholderText("Confirmar senha"), {
      target: { value: "segredo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar usuário" }));

    await waitFor(() => expect(criarUsuario).toHaveBeenCalledWith("ana", "segredo"));
    expect(await screen.findByText("painel")).toBeInTheDocument();
    expect(window.localStorage.getItem("sobreaviso-auth")).toBe("1");
  });

  it("entra com o usuário salvo e recusa senha errada", async () => {
    getUsuario.mockResolvedValue({ usuario: "ana", senhaHash: "x" });
    verificarLogin.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    render(
      <Shell>
        <p>painel</p>
      </Shell>,
    );

    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Usuário"), { target: { value: "ana" } });
    fireEvent.change(screen.getByPlaceholderText("Senha"), { target: { value: "errada" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Usuário ou senha incorretos.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Senha"), { target: { value: "segredo" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("painel")).toBeInTheDocument();
  });

  it("não aceita a sessão antiga sem usuário no banco", async () => {
    window.localStorage.setItem("sobreaviso-auth", "1");
    getUsuario.mockResolvedValue(null);

    render(
      <Shell>
        <p>painel</p>
      </Shell>,
    );

    expect(await screen.findByRole("heading", { name: "Criar usuário local" })).toBeInTheDocument();
    expect(window.localStorage.getItem("sobreaviso-auth")).toBeNull();
  });
});
