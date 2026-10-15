import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Acionamento } from "@/lib/db";

const allSobreavisos = vi.fn();
const allAcionamentos = vi.fn();
const putAcionamento = vi.fn();
const getUsuario = vi.fn();

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return {
    ...actual,
    db: {
      allSobreavisos: (...args: unknown[]) => allSobreavisos(...args),
      allAcionamentos: (...args: unknown[]) => allAcionamentos(...args),
      putAcionamento: (...args: unknown[]) => putAcionamento(...args),
      getUsuario: (...args: unknown[]) => getUsuario(...args),
    },
  };
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  createFileRoute: () => (config: { component: () => ReactNode }) => config,
}));

import { Relatorios } from "@/routes/relatorios";

const acionamento: Acionamento = {
  id: "ac-1",
  sobreaviso_id: "2026-10-14",
  inicio_acionamento: new Date(2026, 9, 14, 22, 0, 0).getTime(),
  fim_acionamento: new Date(2026, 9, 14, 23, 0, 0).getTime(),
  justificativa: "Queda no banco",
};

describe("marcador de lançamento oficial", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 14, 12, 0, 0));
    window.localStorage.setItem("sobreaviso-auth", "1");
    allSobreavisos.mockReset().mockResolvedValue([]);
    allAcionamentos.mockReset().mockResolvedValue([acionamento]);
    putAcionamento.mockReset().mockResolvedValue(undefined);
    getUsuario.mockReset().mockResolvedValue({ usuario: "ana", senhaHash: "x" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marca o acionamento como lançado na plataforma oficial", async () => {
    render(<Relatorios />);

    const caixa = await screen.findByRole("switch", {
      name: "Lançado na plataforma oficial: Queda no banco",
    });
    expect(caixa).not.toBeChecked();
    expect(caixa).toHaveTextContent("Lançar");
    expect(screen.getByText("0 de 1 lançados na plataforma oficial")).toBeInTheDocument();

    fireEvent.click(caixa);

    await vi.waitFor(() => expect(putAcionamento).toHaveBeenCalledOnce());
    expect(putAcionamento.mock.calls[0]![0]).toMatchObject({ id: "ac-1", lancado: true });
  });

  it("mantém o lançamento ao editar o acionamento", async () => {
    allAcionamentos.mockResolvedValue([{ ...acionamento, lancado: true }]);

    render(<Relatorios />);

    const marcador = await screen.findByRole("switch", {
      name: "Lançado na plataforma oficial: Queda no banco",
    });
    expect(marcador).toBeChecked();
    expect(marcador).toHaveTextContent("Lançado");

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => expect(putAcionamento).toHaveBeenCalledOnce());
    expect(putAcionamento.mock.calls[0]![0]).toMatchObject({ id: "ac-1", lancado: true });
  });
});
