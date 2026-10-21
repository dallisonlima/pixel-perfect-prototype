import type { Acionamento, Sobreaviso, Tipo, UsuarioLocal } from "./db";

export interface Backup {
  app: "ponto-sobreaviso";
  versao: 1;
  exportadoEm: string;
  sobreavisos: Sobreaviso[];
  acionamentos: Acionamento[];
  usuario: UsuarioLocal | null;
}

const TIPOS = new Set<Tipo>(["dia_semana", "sabado", "domingo"]);

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function sobreaviso(valor: unknown): valor is Sobreaviso {
  if (!objeto(valor)) return false;
  return (
    typeof valor["id"] === "string" &&
    typeof valor["data"] === "string" &&
    TIPOS.has(valor["tipo"] as Tipo) &&
    (valor["lancado"] === undefined || typeof valor["lancado"] === "boolean")
  );
}

function acionamento(valor: unknown): valor is Acionamento {
  if (!objeto(valor)) return false;
  return (
    typeof valor["id"] === "string" &&
    typeof valor["sobreaviso_id"] === "string" &&
    typeof valor["inicio_acionamento"] === "number" &&
    (valor["fim_acionamento"] === null || typeof valor["fim_acionamento"] === "number") &&
    typeof valor["justificativa"] === "string" &&
    (valor["lancado"] === undefined || typeof valor["lancado"] === "boolean")
  );
}

function usuario(valor: unknown): valor is UsuarioLocal {
  return (
    objeto(valor) && typeof valor["usuario"] === "string" && typeof valor["senhaHash"] === "string"
  );
}

export function lerBackup(texto: string): Backup {
  let valor: unknown;
  try {
    valor = JSON.parse(texto);
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }
  if (!objeto(valor) || valor["app"] !== "ponto-sobreaviso" || valor["versao"] !== 1) {
    throw new Error("Este arquivo não é uma cópia do Ponto de Sobreaviso.");
  }
  if (!Array.isArray(valor["sobreavisos"]) || !valor["sobreavisos"].every(sobreaviso)) {
    throw new Error("A cópia não tem a lista de plantões.");
  }
  if (!Array.isArray(valor["acionamentos"]) || !valor["acionamentos"].every(acionamento)) {
    throw new Error("A cópia não tem a lista de acionamentos.");
  }
  if (valor["usuario"] !== null && !usuario(valor["usuario"])) {
    throw new Error("A cópia não tem o usuário local.");
  }
  return valor as unknown as Backup;
}
