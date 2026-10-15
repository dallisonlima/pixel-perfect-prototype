import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Shell } from "@/components/Shell";
import {
  db,
  diaDoAcionamento,
  plantaoDoAcionamento,
  janela,
  fmtDur,
  fmtHoras,
  TIPO_LABEL,
  type Acionamento,
  type Sobreaviso,
} from "@/lib/db";
import { EspelhoModal } from "@/components/EspelhoModal";
import { gerarEspelhoForaDoPlantao, gerarEspelhoPlantao } from "@/lib/espelho";
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
  const dias = [...doMes].sort((p, q) => p.data.localeCompare(q.data));
  const diasLancados = dias.filter((x) => x.lancado).length;
  const datasPlantao = new Set(dias.map((dia) => dia.data));
  const grupos = [
    ...dias.map((dia) => ({
      id: dia.id,
      data: dia.data,
      plantao: dia,
      chamados: acs.filter(
        (x) =>
          plantaoDoAcionamento(s, x)?.data === dia.data ||
          (foraDoPlantao(x) && diaDoAcionamento(s, x) === dia.data),
      ),
    })),
    ...[
      ...new Set(
        acs
          .filter((x) => foraDoPlantao(x) && !datasPlantao.has(diaDoAcionamento(s, x)))
          .map((x) => diaDoAcionamento(s, x)),
      ),
    ]
      .sort()
      .map((data) => ({
        id: `fora-${data}`,
        data,
        plantao: null as Sobreaviso | null,
        chamados: acs.filter((x) => foraDoPlantao(x) && diaDoAcionamento(s, x) === data),
      })),
  ].sort((p, q) => p.data.localeCompare(q.data));

  const textoDoGrupo = (grupo: (typeof grupos)[number]) => {
    if (!grupo.plantao) {
      return gerarEspelhoForaDoPlantao(s, grupo.chamados)
        .map((p) => p.textoFormatado)
        .join("\n");
    }
    const base = gerarEspelhoPlantao(grupo.plantao, a).textoFormatado;
    const fora = grupo.chamados.filter((x) => foraDoPlantao(x));
    if (fora.length === 0) return base;
    const extra = gerarEspelhoForaDoPlantao(s, fora)
      .map((p) => p.textoFormatado)
      .join("\n");
    return extra ? `${base}\n${extra}` : base;
  };

  const marcarLancado = async (x: Acionamento) => {
    await db.putAcionamento({ ...x, lancado: !x.lancado });
    load();
  };
  const marcarDia = async (dia: Sobreaviso) => {
    await db.marcarSobreavisoLancado(dia.data);
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
          DIAS E ACIONAMENTOS
        </h2>
        {dias.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {diasLancados} de {dias.length} dias lançados na plataforma oficial
          </p>
        )}
      </div>
      {grupos.length === 0 ? (
        <p className="text-muted-foreground">Nenhum plantão ou acionamento neste mês.</p>
      ) : (
        <ul className="space-y-2">
          {grupos.map((grupo) => {
            const texto = textoDoGrupo(grupo);
            const quando = new Date(`${grupo.data}T12:00`).toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
            });
            const copia = <ModeloCopia texto={texto} />;
            return (
              <li
                key={grupo.id}
                className={`panel space-y-3 ${grupo.plantao?.lancado ? "border-success/40" : ""}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium capitalize">{quando}</p>
                    <p className="text-sm text-muted-foreground">
                      {grupo.plantao
                        ? `${TIPO_LABEL[grupo.plantao.tipo]} · ${fmtHoras(janela(grupo.data).horas)}`
                        : "Fora do plantão"}
                      {grupo.chamados.length === 0 ? " · sem acionamento" : ""}
                    </p>
                  </div>
                  {grupo.plantao && (
                    <BotaoLancado
                      on={!!grupo.plantao.lancado}
                      label={`Dia lançado na plataforma oficial: ${grupo.data}`}
                      onClick={() => marcarDia(grupo.plantao!)}
                    />
                  )}
                </div>
                {grupo.chamados.length === 0 ? (
                  copia
                ) : (
                  <>
                    <ul className="space-y-2">
                      {grupo.chamados.map((x) => (
                        <li
                          key={x.id}
                          className="flex flex-col gap-2 rounded-lg border border-border/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="flex flex-wrap items-center gap-2 font-medium">
                              {x.justificativa}
                              {foraDoPlantao(x) && (
                                <span className="badge-extra">Fora do plantão</span>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(x.inicio_acionamento).toLocaleString("pt-BR")} →{" "}
                              {new Date(x.fim_acionamento!).toLocaleTimeString("pt-BR")}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`font-mono ${foraDoPlantao(x) ? "text-info" : "text-primary"}`}
                            >
                              {fmtDur(dur(x))}
                            </span>
                            <BotaoLancado
                              on={!!x.lancado}
                              label={`Lançado na plataforma oficial: ${x.justificativa}`}
                              onClick={() => marcarLancado(x)}
                            />
                            <button className="btn-ghost" onClick={() => setEdit(x)}>
                              Editar
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <details className="group rounded-lg border border-border/60">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm text-muted-foreground [&::-webkit-details-marker]:hidden">
                        Copiar lançamento
                        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="space-y-2 border-t border-border/60 p-3">{copia}</div>
                    </details>
                  </>
                )}
              </li>
            );
          })}
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

function ModeloCopia({ texto }: { texto: string }) {
  return (
    <div className="space-y-2">
      <pre className="overflow-x-auto rounded-lg border border-border bg-background/80 p-3 font-mono text-xs leading-relaxed text-foreground">
        {texto}
      </pre>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => navigator.clipboard.writeText(texto)}
      >
        Copiar
      </button>
    </div>
  );
}

function BotaoLancado({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={on ? "Lançado na plataforma oficial" : "Marcar como lançado"}
      onClick={onClick}
      className={`toggle-lancado ${on ? "toggle-lancado-on" : ""}`}
    >
      <span className="toggle-lancado-icon">
        {on && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      {on ? "Lançado" : "Lançar"}
    </button>
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
