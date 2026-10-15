import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toISO, type Sobreaviso } from "@/lib/db";

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

import { Painel } from "@/routes/index";

const quarta15h = new Date(2026, 9, 14, 15, 0, 0);
const quarta19h = new Date(2026, 9, 14, 19, 0, 0);

describe("painel fora do plantão", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(quarta15h);
    window.localStorage.setItem("sobreaviso-auth", "1");
    allSobreavisos.mockReset();
    allAcionamentos.mockReset();
    putAcionamento.mockReset();
    getUsuario.mockReset();
    getUsuario.mockResolvedValue({ usuario: "ana", senhaHash: "x" });
    allAcionamentos.mockResolvedValue([]);
    putAcionamento.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mostra o botão azul só quando não há plantão e não marca o dia", async () => {
    allSobreavisos.mockResolvedValue([]);

    render(<Painel />);

    const botao = await screen.findByRole("button", { name: "Iniciar fora do plantão" });
    expect(botao.className).toContain("btn-extra");
    expect(screen.queryByRole("button", { name: "Iniciar Acionamento" })).not.toBeInTheDocument();

    fireEvent.click(botao);

    await vi.waitFor(() => expect(putAcionamento).toHaveBeenCalledOnce());
    const salvo = putAcionamento.mock.calls[0][0];
    expect(salvo.sobreaviso_id).toBe(toISO(quarta15h));
    expect(salvo.fim_acionamento).toBeNull();
    expect(allSobreavisos).toHaveBeenCalledOnce();
  });

  it("esconde o botão azul durante o plantão", async () => {
    vi.setSystemTime(quarta19h);
    const plantao: Sobreaviso = { id: "2026-10-14", data: "2026-10-14", tipo: "dia_semana" };
    allSobreavisos.mockResolvedValue([plantao]);

    render(<Painel />);

    expect(await screen.findByRole("button", { name: "Iniciar Acionamento" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Iniciar fora do plantão" }),
    ).not.toBeInTheDocument();
  });
});
