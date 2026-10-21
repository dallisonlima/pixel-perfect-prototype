import { describe, expect, it } from "vitest";
import { lerBackup } from "@/lib/backup";

const copia = {
  app: "ponto-sobreaviso",
  versao: 1,
  exportadoEm: "2026-10-21T00:00:00.000Z",
  sobreavisos: [{ id: "2026-10-10", data: "2026-10-10", tipo: "sabado", lancado: true }],
  acionamentos: [
    {
      id: "ac-1",
      sobreaviso_id: "2026-10-10",
      inicio_acionamento: 1,
      fim_acionamento: 2,
      justificativa: "Queda",
    },
  ],
  usuario: { usuario: "ana", senhaHash: "abc" },
};

describe("cópia dos dados", () => {
  it("aceita um arquivo exportado", () => {
    expect(lerBackup(JSON.stringify(copia))).toMatchObject({
      sobreavisos: [{ id: "2026-10-10" }],
      usuario: { usuario: "ana" },
    });
  });

  it("recusa arquivo de outro app ou JSON inválido", () => {
    expect(() => lerBackup("{")).toThrow(/JSON válido/);
    expect(() => lerBackup(JSON.stringify({ app: "outro", versao: 1 }))).toThrow(/não é uma cópia/);
    expect(() => lerBackup(JSON.stringify({ ...copia, acionamentos: [{ id: "x" }] }))).toThrow(
      /acionamentos/,
    );
  });
});
