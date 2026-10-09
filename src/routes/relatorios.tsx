import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import {
  db,
  diaDoPlantao,
  janela,
  fmtDur,
  fmtHoras,
  type Acionamento,
  type Sobreaviso,
} from "@/lib/db";
import { EspelhoModal } from "@/components/EspelhoModal";

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
  const [edit, setEdit] = useState<Acionamento | null>(null);
  const [novo, setNovo] = useState(false);
  const [espelho, setEspelho] = useState(false);
  const load = () =>
    Promise.all([db.allSobreavisos(), db.allAcionamentos()]).then(([x, y]) => {
      setS(x);
      setA(y);
    });
  useEffect(() => {
    load();
  }, []);

  const doMes = s.filter((x) => x.data.startsWith(mes));
  const ids = new Set(doMes.map((x) => x.id));
  const acs = a
    .filter((x) => ids.has(x.sobreaviso_id) && x.fim_acionamento)
    .sort((p, q) => p.inicio_acionamento - q.inicio_acionamento);
  const hSob = doMes.reduce((t, x) => t + janela(x.data).horas, 0);
  const msTrab = acs.reduce((t, x) => t + (x.fim_acionamento! - x.inicio_acionamento), 0);

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Relatório mensal</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            className="field w-auto"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
          <button
            type="button"
            className="btn-ghost flex items-center gap-1.5"
            onClick={() => setEspelho(true)}
            title="Gerar espelho de ponto contínuo com sobreaviso e acionamentos"
          >
            📋 Espelho de ponto
          </button>
          <button className="btn-primary" onClick={() => setNovo(true)}>
            + Adicionar acionamento
          </button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Dias de sobreaviso" value={String(doMes.length)} />
        <Stat label="Horas em sobreaviso" value={fmtHoras(hSob)} />
        <Stat label="Horas acionadas" value={fmtHoras(msTrab / 3.6e6)} accent />
      </div>
      <h2 className="mb-3 mt-10 font-mono text-xs tracking-widest text-muted-foreground">
        HISTÓRICO DE ACIONAMENTOS
      </h2>
      {acs.length === 0 ? (
        <p className="text-muted-foreground">Nenhum acionamento neste mês.</p>
      ) : (
        <ul className="space-y-2">
          {acs.map((x) => (
            <li
              key={x.id}
              className="panel flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{x.justificativa}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(x.inicio_acionamento).toLocaleString("pt-BR")} →{" "}
                  {new Date(x.fim_acionamento!).toLocaleTimeString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-primary">
                  {fmtDur(x.fim_acionamento! - x.inicio_acionamento)}
                </span>
                <button className="btn-ghost" onClick={() => setEdit(x)}>
                  Editar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {novo && (
        <EditModal
          ac={null}
          onClose={() => setNovo(false)}
          onSaved={() => {
            setNovo(false);
            load();
          }}
        />
      )}
      {edit && (
        <EditModal
          ac={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            load();
          }}
        />
      )}
      {espelho && (
        <EspelhoModal
          sobreavisos={doMes}
          acionamentos={a}
          mesFormatado={mes}
          onClose={() => setEspelho(false)}
        />
      )}
    </Shell>
  );
}

const toLocal = (ms: number) => {
  const d = new Date(ms);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function EditModal({
  ac,
  onClose,
  onSaved,
}: {
  ac: Acionamento | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [ini, setIni] = useState(ac ? toLocal(ac.inicio_acionamento) : "");
  const [fim, setFim] = useState(ac ? toLocal(ac.fim_acionamento!) : "");
  const [just, setJust] = useState(ac?.justificativa ?? "");
  const i = new Date(ini).getTime(),
    f = new Date(fim).getTime();
  const erro =
    !ini || !fim
      ? "Informe início e fim."
      : !just.trim()
        ? "Informe a justificativa."
        : !(f > i)
          ? "O fim deve ser depois do início."
          : "";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur">
      <div className="panel w-full max-w-md space-y-4">
        <h2 className="text-xl font-semibold">
          {ac ? "Editar acionamento" : "Adicionar acionamento"}
        </h2>
        {!ac && (
          <p className="text-sm text-muted-foreground">
            Se o dia não estiver marcado como sobreaviso, ele será marcado automaticamente.
          </p>
        )}
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Início</span>
          <input
            type="datetime-local"
            className="field"
            value={ini}
            onChange={(e) => setIni(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Fim</span>
          <input
            type="datetime-local"
            className="field"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Justificativa</span>
          <textarea
            className="field min-h-24"
            value={just}
            onChange={(e) => setJust(e.target.value)}
          />
        </label>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <div className="flex flex-wrap justify-between gap-2">
          {ac ? (
            <button
              className="btn-ghost text-destructive"
              onClick={async () => {
                if (confirm("Excluir este acionamento?")) {
                  await db.deleteAcionamento(ac.id);
                  onSaved();
                }
              }}
            >
              Excluir
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              disabled={!!erro}
              onClick={async () => {
                const dia = diaDoPlantao(i);
                await db.ensureSobreaviso(dia);
                await db.putAcionamento({
                  id: ac?.id ?? crypto.randomUUID(),
                  sobreaviso_id: dia,
                  inicio_acionamento: i,
                  fim_acionamento: f,
                  justificativa: just.trim(),
                });
                onSaved();
              }}
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
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
