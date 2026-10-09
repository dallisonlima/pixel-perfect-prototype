// IndexedDB local (100% client-side) — stores: sobreavisos, acionamentos
export type Tipo = "dia_semana" | "sabado" | "domingo";
export interface Sobreaviso {
  id: string;
  data: string;
  tipo: Tipo;
}
export interface Acionamento {
  id: string;
  sobreaviso_id: string;
  inicio_acionamento: number;
  fim_acionamento: number | null;
  justificativa: string;
}

const DB = "ponto-sobreaviso";
let dbp: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  if (!dbp)
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore("sobreavisos", { keyPath: "id" });
        const a = d.createObjectStore("acionamentos", { keyPath: "id" });
        a.createIndex("sobreaviso_id", "sobreaviso_id");
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  return dbp;
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
  putAcionamento: async (a: Acionamento) => req((await store("acionamentos", "readwrite")).put(a)),
  deleteAcionamento: async (id: string) =>
    req((await store("acionamentos", "readwrite")).delete(id)),
  ensureSobreaviso: async (data: string) =>
    req((await store("sobreavisos", "readwrite")).put({ id: data, data, tipo: tipoDe(data) })),
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
