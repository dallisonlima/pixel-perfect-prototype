// IndexedDB local (100% client-side) — stores: sobreavisos, acionamentos
export type Tipo = "dia_semana" | "sabado" | "domingo";
export interface Sobreaviso {
  id: string;
  data: string;
  tipo: Tipo;
  /** Dia já lançado na plataforma oficial, mesmo sem acionamento. */
  lancado?: boolean;
}
export interface Acionamento {
  id: string;
  sobreaviso_id: string;
  inicio_acionamento: number;
  fim_acionamento: number | null;
  justificativa: string;
  /** Já lançado na plataforma oficial. Ausente nos registros antigos. */
  lancado?: boolean;
}

export interface UsuarioLocal {
  usuario: string;
  senhaHash: string;
}

const DB = "ponto-sobreaviso";
let dbp: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  if (!dbp)
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 2);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains("sobreavisos"))
          d.createObjectStore("sobreavisos", { keyPath: "id" });
        if (!d.objectStoreNames.contains("acionamentos")) {
          const a = d.createObjectStore("acionamentos", { keyPath: "id" });
          a.createIndex("sobreaviso_id", "sobreaviso_id");
        }
        if (!d.objectStoreNames.contains("usuarios"))
          d.createObjectStore("usuarios", { keyPath: "usuario" });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  return dbp;
}

async function hashSenha(senha: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(senha));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
function req<T>(r: IDBRequest<T>) {
  return new Promise<T>((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function store(name: string, mode: IDBTransactionMode = "readonly") {
  return (await open()).transaction(name, mode).objectStore(name);
}

export const db = {
  allSobreavisos: async () => req<Sobreaviso[]>((await store("sobreavisos")).getAll()),
  allAcionamentos: async () => req<Acionamento[]>((await store("acionamentos")).getAll()),
  toggleSobreaviso: async (data: string) => {
    const s = await store("sobreavisos", "readwrite");
    const existing = await req<Sobreaviso | undefined>(s.get(data));
    if (existing) await req(s.delete(data));
    else await req(s.put({ id: data, data, tipo: tipoDe(data) }));
  },
  marcarSobreavisoLancado: async (data: string) => {
    const s = await store("sobreavisos", "readwrite");
    const existing = await req<Sobreaviso | undefined>(s.get(data));
    if (!existing) return;
    await req(s.put({ ...existing, lancado: !existing.lancado }));
  },
  putAcionamento: async (a: Acionamento) => req((await store("acionamentos", "readwrite")).put(a)),
  deleteAcionamento: async (id: string) =>
    req((await store("acionamentos", "readwrite")).delete(id)),
  getUsuario: async () => {
    const all = await req<UsuarioLocal[]>((await store("usuarios")).getAll());
    return all[0] ?? null;
  },
  criarUsuario: async (usuario: string, senha: string) => {
    const nome = usuario.trim();
    if (!nome || !senha) throw new Error("Informe usuário e senha.");
    if (await db.getUsuario()) throw new Error("Já existe um usuário neste navegador.");
    const senhaHash = await hashSenha(senha);
    await req((await store("usuarios", "readwrite")).put({ usuario: nome, senhaHash }));
  },
  verificarLogin: async (usuario: string, senha: string) => {
    const salvo = await db.getUsuario();
    if (!salvo || salvo.usuario !== usuario.trim()) return false;
    return salvo.senhaHash === (await hashSenha(senha));
  },
};

// Descobre a qual dia de sobreaviso um horário pertence (antes das 08h → plantão do dia anterior)
export function diaDoPlantao(ms: number) {
  const d = new Date(ms);
  if (d.getHours() < 8) d.setDate(d.getDate() - 1);
  return toISO(d);
}

// ---------- Regras de horário ----------
export function parseDate(iso: string) {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function tipoDe(iso: string): Tipo {
  const w = parseDate(iso).getDay();
  return w === 6 ? "sabado" : w === 0 ? "domingo" : "dia_semana";
}
export function janela(iso: string) {
  const d = parseDate(iso);
  const t = tipoDe(iso);
  const inicio = new Date(d);
  inicio.setHours(t === "dia_semana" ? 18 : 8, 0, 0, 0);
  const fim = new Date(d);
  fim.setDate(fim.getDate() + 1);
  fim.setHours(8, 0, 0, 0);
  return { inicio, fim, horas: (fim.getTime() - inicio.getTime()) / 3.6e6 };
}
export function sobreavisoAtivo(list: Sobreaviso[], now = new Date()) {
  return list.find((s) => {
    const j = janela(s.data);
    return now >= j.inicio && now < j.fim;
  });
}
// Acionamentos que começam fora de qualquer plantão marcado são trabalho avulso (ex: agendado)
export function plantaoDoAcionamento(
  list: Sobreaviso[],
  a: Pick<Acionamento, "inicio_acionamento">,
) {
  return sobreavisoAtivo(list, new Date(a.inicio_acionamento));
}
export function diaDoAcionamento(list: Sobreaviso[], a: Pick<Acionamento, "inicio_acionamento">) {
  return plantaoDoAcionamento(list, a)?.data ?? toISO(new Date(a.inicio_acionamento));
}
export function fmtDur(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
export const fmtHoras = (h: number) =>
  `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;
export const TIPO_LABEL: Record<Tipo, string> = {
  dia_semana: "Dia útil · 18h→08h",
  sabado: "Sábado · 24h",
  domingo: "Domingo · 24h",
};
