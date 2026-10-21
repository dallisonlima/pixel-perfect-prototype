import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUsuario = vi.fn();
const criarUsuario = vi.fn();
const verificarLogin = vi.fn();
const exportar = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    getUsuario: (...args: unknown[]) => getUsuario(...args),
    criarUsuario: (...args: unknown[]) => criarUsuario(...args),
    verificarLogin: (...args: unknown[]) => verificarLogin(...args),
    exportar: (...args: unknown[]) => exportar(...args),
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
    exportar.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("baixa uma cópia dos dados em Ajustes", async () => {
    window.localStorage.setItem("sobreaviso-auth", "1");
    getUsuario.mockResolvedValue({ usuario: "ana", senhaHash: "x" });
    exportar.mockResolvedValue({
      app: "ponto-sobreaviso",
      versao: 1,
      exportadoEm: "2026-10-21T00:00:00.000Z",
      sobreavisos: [],
      acionamentos: [],
      usuario: null,
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:copia");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <Shell>
        <p>painel</p>
      </Shell>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Ajustes" }));
    fireEvent.click(screen.getByRole("button", { name: "Baixar dados" }));

    await waitFor(() => expect(exportar).toHaveBeenCalledOnce());
    expect(click).toHaveBeenCalled();
    expect(screen.getByText(/Cópia baixada/)).toBeInTheDocument();
  });
});
