import { describe, expect, it } from "vitest";
import {
  diaDoAcionamento,
  parseDate,
  plantaoDoAcionamento,
  type Acionamento,
  type Sobreaviso,
} from "@/lib/db";
import { gerarEspelhoForaDoPlantao, gerarEspelhoMes, gerarEspelhoPlantao } from "@/lib/espelho";

const em = (iso: string, h: number, m = 0) => {
  const d = parseDate(iso);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

// 2026-10-08 é quinta-feira (plantão 18h → 08h do dia 09)
const plantao: Sobreaviso = { id: "2026-10-08", data: "2026-10-08", tipo: "dia_semana" };

describe("acionamento fora do plantão", () => {
  it("não pertence a nenhum plantão quando o dia não está marcado", () => {
    const ac = { inicio_acionamento: em("2026-10-12", 22) };
    expect(plantaoDoAcionamento([], ac)).toBeUndefined();
    expect(diaDoAcionamento([], ac)).toBe("2026-10-12");
  });

  it("usa o dia do calendário para trabalho de madrugada sem plantão", () => {
    const ac = { inicio_acionamento: em("2026-10-13", 2) };
    expect(diaDoAcionamento([plantao], ac)).toBe("2026-10-13");
  });

  it("fica fora quando é no horário comercial de um dia útil marcado", () => {
    const ac = { inicio_acionamento: em("2026-10-08", 10) };
    expect(plantaoDoAcionamento([plantao], ac)).toBeUndefined();
    expect(diaDoAcionamento([plantao], ac)).toBe("2026-10-08");
  });

  it("pertence ao plantão quando começa dentro da janela, inclusive depois da meia-noite", () => {
    expect(plantaoDoAcionamento([plantao], { inicio_acionamento: em("2026-10-08", 19) })).toBe(
      plantao,
    );
    expect(diaDoAcionamento([plantao], { inicio_acionamento: em("2026-10-09", 3) })).toBe(
      "2026-10-08",
    );
  });

  it("não entra no espelho do plantão quando ocorreu antes da janela", () => {
    const agendado: Acionamento = {
      id: "ag",
      sobreaviso_id: "2026-10-08",
      inicio_acionamento: em("2026-10-08", 10),
      fim_acionamento: em("2026-10-08", 11),
      justificativa: "Janela de manutenção agendada",
    };

    const espelho = gerarEspelhoPlantao(plantao, [agendado]);

    expect(espelho.linhas.map((l) => l.texto)).toEqual([
      "18:00 -> 23:59 = Sobreaviso",
      "00:00 -> 07:59 = Sobreaviso",
    ]);
  });

  it("lista no espelho só as horas trabalhadas, sem preencher sobreaviso", () => {
    const manha: Acionamento = {
      id: "ag",
      sobreaviso_id: "2026-10-12",
      inicio_acionamento: em("2026-10-12", 10),
      fim_acionamento: em("2026-10-12", 11, 30),
      justificativa: "Janela de manutenção agendada",
    };
    const tarde: Acionamento = {
      id: "ag2",
      sobreaviso_id: "2026-10-12",
      inicio_acionamento: em("2026-10-12", 14),
      fim_acionamento: em("2026-10-12", 15),
      justificativa: "Deploy",
    };

    const [bloco] = gerarEspelhoForaDoPlantao([], [tarde, manha]);

    expect(bloco?.titulo).toBe("Fora do plantão · 12/10/2026");
    expect(bloco?.linhas.map((l) => l.texto)).toEqual([
      "10:00 -> 11:30 = Janela de manutenção agendada",
      "14:00 -> 15:00 = Deploy",
    ]);
    expect(bloco?.textoFormatado).not.toContain("Sobreaviso");
  });

  it("quebra na meia-noite o trabalho fora do plantão e mantém o plantão separado", () => {
    const atravessa: Acionamento = {
      id: "noite",
      sobreaviso_id: "2026-10-12",
      inicio_acionamento: em("2026-10-12", 23, 30),
      fim_acionamento: em("2026-10-13", 1, 15),
      justificativa: "Trabalho agendado",
    };

    const mes = gerarEspelhoMes([plantao], [atravessa]);

    expect(mes.map((p) => p.titulo)).toEqual([
      "Plantão de 08/10/2026 a 09/10/2026",
      "Fora do plantão de 12/10/2026 a 13/10/2026",
    ]);
    expect(mes[1]?.linhas.map((l) => l.texto)).toEqual([
      "23:30 -> 23:59 = Trabalho agendado",
      "00:00 -> 01:15 = Trabalho agendado",
    ]);
    expect(mes.map((p) => p.foraDoPlantao)).toEqual([false, true]);
  });

  it("filtra o trabalho fora do plantão pelo mês do relatório", () => {
    const outubro: Acionamento = {
      id: "out",
      sobreaviso_id: "2026-10-12",
      inicio_acionamento: em("2026-10-12", 10),
      fim_acionamento: em("2026-10-12", 11),
      justificativa: "Outubro",
    };
    const novembro: Acionamento = {
      id: "nov",
      sobreaviso_id: "2026-11-03",
      inicio_acionamento: em("2026-11-03", 10),
      fim_acionamento: em("2026-11-03", 11),
      justificativa: "Novembro",
    };

    expect(gerarEspelhoMes([], [outubro, novembro], "2026-10").map((p) => p.titulo)).toEqual([
      "Fora do plantão · 12/10/2026",
    ]);
  });
});
