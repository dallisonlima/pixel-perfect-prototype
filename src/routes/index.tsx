import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import {
  db,
  sobreavisoAtivo,
  janela,
  fmtDur,
  TIPO_LABEL,
  type Acionamento,
  type Sobreaviso,
} from "@/lib/db";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel — Ponto de Sobreaviso" },
      { name: "description", content: "Inicie e finalize acionamentos durante o sobreaviso." },
      { property: "og:title", content: "Painel — Ponto de Sobreaviso" },
      {
        property: "og:description",
        content: "Inicie e finalize acionamentos durante o sobreaviso.",
      },
    ],
  }),
  component: Painel,
});

function Painel() {
  const [list, setList] = useState<Sobreaviso[]>([]);
  const [aberto, setAberto] = useState<Acionamento | null>(null);
  const [now, setNow] = useState(Date.now());
  const [modal, setModal] = useState(false);
  const [just, setJust] = useState("");
  const [ready, setReady] = useState(false);

  const load = async () => {
    const [s, a] = await Promise.all([db.allSobreavisos(), db.allAcionamentos()]);
    setList(s);
    setAberto(a.find((x) => x.fim_acionamento === null) ?? null);
    setReady(true);
  };
  useEffect(() => {
    load();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ativo = sobreavisoAtivo(list, new Date(now));
  const proximo = list
    .map((s) => ({ s, j: janela(s.data) }))
    .filter((x) => x.j.inicio.getTime() > now)
    .sort((a, b) => a.j.inicio.getTime() - b.j.inicio.getTime())[0];

  const iniciar = async () => {
    if (!ativo) return;
    const a: Acionamento = {
      id: crypto.randomUUID(),
      sobreaviso_id: ativo.id,
      inicio_acionamento: Date.now(),
      fim_acionamento: null,
      justificativa: "",
    };
    await db.putAcionamento(a);
    setAberto(a);
  };
  const finalizar = async () => {
    if (!aberto || !just.trim()) return;
    await db.putAcionamento({ ...aberto, fim_acionamento: Date.now(), justificativa: just.trim() });
    setJust("");
    setModal(false);
    setAberto(null);
  };

  if (!ready)
    return (
      <Shell>
        <p className="text-muted-foreground">Carregando…</p>
      </Shell>
    );

  return (
    <Shell>
      <section className="panel flex flex-col items-center gap-6 py-14 text-center">
        {aberto ? (
          <>
            <span className="badge-live">● Acionamento em andamento</span>
            <div className="font-mono text-6xl tabular-nums sm:text-7xl">
              {fmtDur(now - aberto.inicio_acionamento)}
            </div>
            <p className="text-sm text-muted-foreground">
              Início: {new Date(aberto.inicio_acionamento).toLocaleString("pt-BR")}
            </p>
            <button className="btn-big btn-stop" onClick={() => setModal(true)}>
              Finalizar Acionamento
            </button>
          </>
        ) : ativo ? (
          <>
            <span className="badge-on">Você está de sobreaviso</span>
            <p className="text-muted-foreground">
              {TIPO_LABEL[ativo.tipo]} · até{" "}
              {janela(ativo.data).fim.toLocaleString("pt-BR", {
                weekday: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <button className="btn-big" onClick={iniciar}>
              Iniciar Acionamento
            </button>
          </>
        ) : (
          <>
            <span className="badge-off">Fora do sobreaviso</span>
            <h1 className="text-3xl font-semibold">Nenhum plantão ativo agora</h1>
            <p className="text-muted-foreground">
              {proximo
                ? `Próximo: ${proximo.j.inicio.toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                : "Marque seus dias no Calendário."}
            </p>
          </>
        )}
      </section>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur">
          <div className="panel w-full max-w-md space-y-4">
            <h2 className="text-xl font-semibold">Justificativa do acionamento</h2>
            <textarea
              autoFocus
              className="field min-h-28"
              placeholder="Ex: Acionamento por problema no MongoDB"
              value={just}
              onChange={(e) => setJust(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setModal(false)}>
                Voltar
              </button>
              <button className="btn-primary" disabled={!just.trim()} onClick={finalizar}>
                Salvar e finalizar
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
