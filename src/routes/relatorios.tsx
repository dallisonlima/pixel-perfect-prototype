import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { db, janela, fmtDur, fmtHoras, type Acionamento, type Sobreaviso } from "@/lib/db";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Ponto de Sobreaviso" },
      { name: "description", content: "Horas de sobreaviso e acionamentos por mês." },
      { property: "og:title", content: "Relatórios — Ponto de Sobreaviso" },
      { property: "og:description", content: "Horas de sobreaviso e acionamentos por mês." },
    ],
  }),
  component: Relatorios,
});

function Relatorios() {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [s, setS] = useState<Sobreaviso[]>([]);
  const [a, setA] = useState<Acionamento[]>([]);
  useEffect(() => { Promise.all([db.allSobreavisos(), db.allAcionamentos()]).then(([x, y]) => { setS(x); setA(y); }); }, []);

  const doMes = s.filter((x) => x.data.startsWith(mes));
  const ids = new Set(doMes.map((x) => x.id));
  const acs = a.filter((x) => ids.has(x.sobreaviso_id) && x.fim_acionamento).sort((p, q) => p.inicio_acionamento - q.inicio_acionamento);
  const hSob = doMes.reduce((t, x) => t + janela(x.data).horas, 0);
  const msTrab = acs.reduce((t, x) => t + (x.fim_acionamento! - x.inicio_acionamento), 0);

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Relatório mensal</h1>
        <input type="month" className="field w-auto" value={mes} onChange={(e) => setMes(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Dias de sobreaviso" value={String(doMes.length)} />
        <Stat label="Horas em sobreaviso" value={fmtHoras(hSob)} />
        <Stat label="Horas acionadas" value={fmtHoras(msTrab / 3.6e6)} accent />
      </div>
      <h2 className="mb-3 mt-10 font-mono text-xs tracking-widest text-muted-foreground">HISTÓRICO DE ACIONAMENTOS</h2>
      {acs.length === 0 ? <p className="text-muted-foreground">Nenhum acionamento neste mês.</p> : (
        <ul className="space-y-2">
          {acs.map((x) => (
            <li key={x.id} className="panel flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{x.justificativa}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(x.inicio_acionamento).toLocaleString("pt-BR")} → {new Date(x.fim_acionamento!).toLocaleTimeString("pt-BR")}
                </p>
              </div>
              <span className="font-mono text-primary">{fmtDur(x.fim_acionamento! - x.inicio_acionamento)}</span>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="panel">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-3xl ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
