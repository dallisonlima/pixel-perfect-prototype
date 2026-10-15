import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Shell } from "@/components/Shell";
import {
  db,
  diaDoAcionamento,
  plantaoDoAcionamento,
  janela,
  fmtDur,
  fmtHoras,
  type Acionamento,
  type Sobreaviso,
} from "@/lib/db";
import { EspelhoModal } from "@/components/EspelhoModal";
import { DateTimePicker, MonthPicker } from "@/components/DatePickers";

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

export function Relatorios() {
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
  const acs = a
    .filter((x) => x.fim_acionamento && diaDoAcionamento(s, x).startsWith(mes))
    .sort((p, q) => p.inicio_acionamento - q.inicio_acionamento);
  const foraDoPlantao = (x: Acionamento) => !plantaoDoAcionamento(s, x);
  const dur = (x: Acionamento) => x.fim_acionamento! - x.inicio_acionamento;
  const hSob = doMes.reduce((t, x) => t + janela(x.data).horas, 0);
  const msTrab = acs.filter((x) => !foraDoPlantao(x)).reduce((t, x) => t + dur(x), 0);
  const msExtra = acs.filter(foraDoPlantao).reduce((t, x) => t + dur(x), 0);
  const lancados = acs.filter((x) => x.lancado).length;

  const marcarLancado = async (x: Acionamento) => {
    await db.putAcionamento({ ...x, lancado: !x.lancado });
    load();
  };

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Relatório mensal</h1>
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker value={mes} onChange={setMes} />
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Dias de sobreaviso" value={String(doMes.length)} />
        <Stat label="Horas em sobreaviso" value={fmtHoras(hSob)} />
        <Stat label="Horas acionadas" value={fmtHoras(msTrab / 3.6e6)} accent="primary" />
        <Stat label="Fora do plantão" value={fmtHoras(msExtra / 3.6e6)} accent="info" />
      </div>
      <div className="mb-3 mt-10 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-xs tracking-widest text-muted-foreground">
          HISTÓRICO DE ACIONAMENTOS
        </h2>
        {acs.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {lancados} de {acs.length} lançados na plataforma oficial
          </p>
        )}
      </div>
      {acs.length === 0 ? (
        <p className="text-muted-foreground">Nenhum acionamento neste mês.</p>
      ) : (
        <ul className="space-y-2">
          {acs.map((x) => (
            <li
              key={x.id}
              className={`panel flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between ${x.lancado ? "border-success/40" : ""}`}
            >
              <div>
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {x.justificativa}
                  {foraDoPlantao(x) && <span className="badge-extra">Fora do plantão</span>}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(x.inicio_acionamento).toLocaleString("pt-BR")} →{" "}
                  {new Date(x.fim_acionamento!).toLocaleTimeString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-mono ${foraDoPlantao(x) ? "text-info" : "text-primary"}`}>
                  {fmtDur(dur(x))}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!x.lancado}
                  aria-label={`Lançado na plataforma oficial: ${x.justificativa}`}
                  title={x.lancado ? "Lançado na plataforma oficial" : "Marcar como lançado"}
                  onClick={() => marcarLancado(x)}
                  className={`toggle-lancado ${x.lancado ? "toggle-lancado-on" : ""}`}
                >
                  <span className="toggle-lancado-icon">
                    {x.lancado && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  {x.lancado ? "Lançado" : "Lançar"}
                </button>
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
          sobreavisos={s}
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
          sobreavisos={s}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            load();
          }}
        />
      )}
      {espelho && (
        <EspelhoModal
          sobreavisos={s}
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
  sobreavisos,
  onClose,
  onSaved,
}: {
  ac: Acionamento | null;
  sobreavisos: Sobreaviso[];
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
            Se o horário não estiver dentro de um plantão marcado, as horas ficam registradas como
            fora do plantão (azul no calendário) e o dia não é marcado como sobreaviso.
          </p>
        )}
        <div className="space-y-1 text-sm">
          <span className="text-muted-foreground">Início</span>
          <DateTimePicker label="Início" value={ini} onChange={setIni} />
        </div>
        <div className="space-y-1 text-sm">
          <span className="text-muted-foreground">Fim</span>
          <DateTimePicker label="Fim" value={fim} onChange={setFim} />
        </div>
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
                await db.putAcionamento({
                  id: ac?.id ?? crypto.randomUUID(),
                  sobreaviso_id: diaDoAcionamento(sobreavisos, { inicio_acionamento: i }),
                  inicio_acionamento: i,
                  fim_acionamento: f,
                  justificativa: just.trim(),
                  ...(ac?.lancado ? { lancado: true } : {}),
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

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "primary" | "info";
}) {
  const cor = accent === "primary" ? "text-primary" : accent === "info" ? "text-info" : "";
  return (
    <div className="panel">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-3xl ${cor}`}>{value}</p>
    </div>
  );
}
