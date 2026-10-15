import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Acionamento, Sobreaviso } from "@/lib/db";

const allSobreavisos = vi.fn();
const allAcionamentos = vi.fn();
const getUsuario = vi.fn();

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return {
    ...actual,
    db: {
      allSobreavisos: (...args: unknown[]) => allSobreavisos(...args),
      allAcionamentos: (...args: unknown[]) => allAcionamentos(...args),
      getUsuario: (...args: unknown[]) => getUsuario(...args),
    },
  };
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  createFileRoute: () => (config: { component: () => ReactNode }) => config,
}));

import { Calendario } from "@/routes/calendario";

const ac = (id: string, dia: number, lancado: boolean): Acionamento => ({
  id,
  sobreaviso_id: `2026-10-${String(dia).padStart(2, "0")}`,
  inicio_acionamento: new Date(2026, 9, dia, 10, 0, 0).getTime(),
  fim_acionamento: new Date(2026, 9, dia, 11, 0, 0).getTime(),
  justificativa: id,
  lancado,
});

describe("calendário com lançamentos", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0));
    window.localStorage.setItem("sobreaviso-auth", "1");
    allSobreavisos.mockReset().mockResolvedValue([]);
    getUsuario.mockReset().mockResolvedValue({ usuario: "ana", senhaHash: "x" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marca de verde só os dias com todos os acionamentos lançados e mostra a legenda", async () => {
    allAcionamentos
      .mockReset()
      .mockResolvedValue([ac("a", 6, true), ac("b", 6, true), ac("c", 7, true), ac("d", 7, false)]);

    render(<Calendario />);

    const dia = (n: string) =>
      screen.getByText(n, { selector: "span.font-mono" }).closest("button")!;
    await vi.waitFor(() =>
      expect(within(dia("6")).getByLabelText("Lançado na plataforma oficial")).toBeInTheDocument(),
    );
    const dia7 = dia("7");
    expect(within(dia7).queryByLabelText("Lançado na plataforma oficial")).not.toBeInTheDocument();

    expect(screen.getByText("LEGENDA")).toBeInTheDocument();
    expect(screen.getByText("Plantão marcado")).toBeInTheDocument();
    expect(screen.getByText(/Horas fora do plantão/)).toBeInTheDocument();
    expect(screen.getByText(/Dia lançado na plataforma oficial/)).toBeInTheDocument();
  });

  it("mostra o selo no plantão marcado como lançado, mesmo sem acionamento", async () => {
    const plantao: Sobreaviso = {
      id: "2026-10-10",
      data: "2026-10-10",
      tipo: "sabado",
      lancado: true,
    };
    allSobreavisos.mockResolvedValue([plantao]);
    allAcionamentos.mockResolvedValue([]);

    render(<Calendario />);

    const dia = (n: string) =>
      screen.getByText(n, { selector: "span.font-mono" }).closest("button")!;
    await vi.waitFor(() =>
      expect(within(dia("10")).getByLabelText("Lançado na plataforma oficial")).toBeInTheDocument(),
    );
    expect(
      within(dia("11")).queryByLabelText("Lançado na plataforma oficial"),
    ).not.toBeInTheDocument();
  });
});
