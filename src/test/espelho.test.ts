import { describe, expect, it } from "vitest";
import { gerarEspelhoPlantao } from "@/lib/espelho";
import { parseDate, type Sobreaviso, type Acionamento } from "@/lib/db";

describe("Espelho de Plantão", () => {
  it("gera exatamente o formato solicitado para o plantão de 08 a 09 com 2 acionamentos", () => {
    // 2026-10-08 é quinta-feira (dia útil)
    const sobreaviso: Sobreaviso = {
      id: "2026-10-08",
      data: "2026-10-08",
      tipo: "dia_semana",
    };

    const d1 = parseDate("2026-10-08");
    const d2 = parseDate("2026-10-09");

    const ac1Ini = new Date(d1);
    ac1Ini.setHours(19, 51, 0, 0);
    const ac1Fim = new Date(d1);
    ac1Fim.setHours(20, 20, 0, 0);

    const ac2Ini = new Date(d2);
    ac2Ini.setHours(0, 46, 0, 0);
    const ac2Fim = new Date(d2);
    ac2Fim.setHours(1, 30, 0, 0);

    const acionamentos: Acionamento[] = [
      {
        id: "ac-1",
        sobreaviso_id: "2026-10-08",
        inicio_acionamento: ac1Ini.getTime(),
        fim_acionamento: ac1Fim.getTime(),
        justificativa: "Problema no banco de dados",
      },
      {
        id: "ac-2",
        sobreaviso_id: "2026-10-08",
        inicio_acionamento: ac2Ini.getTime(),
        fim_acionamento: ac2Fim.getTime(),
        justificativa: "Erro no serviço de autenticação",
      },
    ];

    const espelho = gerarEspelhoPlantao(sobreaviso, acionamentos);

    expect(espelho.linhas.map((l) => l.texto)).toEqual([
      "19:00 -> 19:50 = Sobreaviso",
      "19:51 -> 20:20 = Problema no banco de dados",
      "20:21 -> 23:59 = Sobreaviso",
      "00:00 -> 00:45 = Sobreaviso",
      "00:46 -> 01:30 = Erro no serviço de autenticação",
      "01:31 -> 07:59 = Sobreaviso",
    ]);

    expect(espelho.textoFormatado).toBe(
      "19:00 -> 19:50 = Sobreaviso\n" +
        "19:51 -> 20:20 = Problema no banco de dados\n" +
        "20:21 -> 23:59 = Sobreaviso\n" +
        "00:00 -> 00:45 = Sobreaviso\n" +
        "00:46 -> 01:30 = Erro no serviço de autenticação\n" +
        "01:31 -> 07:59 = Sobreaviso",
    );
  });

  it("gera sobreaviso completo quando não há acionamentos", () => {
    const sobreaviso: Sobreaviso = {
      id: "2026-10-08",
      data: "2026-10-08",
      tipo: "dia_semana",
    };

    const espelho = gerarEspelhoPlantao(sobreaviso, []);

    expect(espelho.linhas.map((l) => l.texto)).toEqual([
      "19:00 -> 23:59 = Sobreaviso",
      "00:00 -> 07:59 = Sobreaviso",
    ]);
  });

  it("divide acionamento que cruza a meia-noite em 23:59 e continua no dia seguinte às 00:00", () => {
    const sobreaviso: Sobreaviso = {
      id: "2026-10-08",
      data: "2026-10-08",
      tipo: "dia_semana",
    };

    const d1 = parseDate("2026-10-08");
    const d2 = parseDate("2026-10-09");

    const acIni = new Date(d1);
    acIni.setHours(23, 30, 0, 0);
    const acFim = new Date(d2);
    acFim.setHours(1, 15, 0, 0);

    const acionamentos: Acionamento[] = [
      {
        id: "ac-cross",
        sobreaviso_id: "2026-10-08",
        inicio_acionamento: acIni.getTime(),
        fim_acionamento: acFim.getTime(),
        justificativa: "Incidente crítico",
      },
    ];

    const espelho = gerarEspelhoPlantao(sobreaviso, acionamentos);

    expect(espelho.linhas.map((l) => l.texto)).toEqual([
      "19:00 -> 23:29 = Sobreaviso",
      "23:30 -> 23:59 = Incidente crítico",
      "00:00 -> 01:15 = Incidente crítico",
      "01:16 -> 07:59 = Sobreaviso",
    ]);
  });

  it("gera espelho para finais de semana iniciando às 08:00", () => {
    const sobreaviso: Sobreaviso = {
      id: "2026-10-10",
      data: "2026-10-10", // Sábado
      tipo: "sabado",
    };

    const espelho = gerarEspelhoPlantao(sobreaviso, []);

    expect(espelho.linhas.map((l) => l.texto)).toEqual([
      "08:00 -> 23:59 = Sobreaviso",
      "00:00 -> 07:59 = Sobreaviso",
    ]);
  });
});
