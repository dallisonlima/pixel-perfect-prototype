import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Shell } from "@/components/Shell";
import { db, diaDoAcionamento, plantaoDoAcionamento, toISO, tipoDe } from "@/lib/db";

export const Route = createFileRoute("/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário — Ponto de Sobreaviso" },
      { name: "description", content: "Marque os dias em que você estará de sobreaviso." },
      { property: "og:title", content: "Calendário — Ponto de Sobreaviso" },
      { property: "og:description", content: "Marque os dias em que você estará de sobreaviso." },
    ],
  }),
  component: Calendario,
});

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function Calendario() {
  const [ref, setRef] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [avulsos, setAvulsos] = useState<Set<string>>(new Set());
  const [lancados, setLancados] = useState<Set<string>>(new Set());
  const load = async () => {
    const [s, a] = await Promise.all([db.allSobreavisos(), db.allAcionamentos()]);
    setMarcados(new Set(s.map((x) => x.data)));
    setAvulsos(
      new Set(a.filter((x) => !plantaoDoAcionamento(s, x)).map((x) => diaDoAcionamento(s, x))),
    );
    const dias = new Set(s.filter((x) => x.lancado).map((x) => x.data));
    const porDia = new Map<string, boolean>();
    for (const x of a) {
      if (!x.fim_acionamento) continue;
      const dia = diaDoAcionamento(s, x);
      if (s.some((p) => p.data === dia)) continue;
      porDia.set(dia, (porDia.get(dia) ?? true) && !!x.lancado);
    }
    for (const [dia, ok] of porDia) if (ok) dias.add(dia);
    setLancados(dias);
  };
  useEffect(() => {
    load();
  }, []);

  const first = ref.getDay();
  const total = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(first).fill(null),
    ...Array.from({ length: total }, (_, i) => new Date(ref.getFullYear(), ref.getMonth(), i + 1)),
  ];
  const hoje = toISO(new Date());
  const shift = (n: number) => setRef(new Date(ref.getFullYear(), ref.getMonth() + n, 1));

  return (
    <Shell>
      <div className="mb-6 flex items-center justify-between">
        <button className="btn-ghost" onClick={() => shift(-1)}>
          ←
        </button>
        <h1 className="text-2xl font-semibold capitalize">
          {ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </h1>
        <button className="btn-ghost" onClick={() => shift(1)}>
          →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {DIAS.map((d) => (
          <div key={d} className="pb-1 text-center font-mono text-xs text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const iso = toISO(d);
          const on = marcados.has(iso);
          const avulso = avulsos.has(iso);
          const lancado = lancados.has(iso);
          const dicas = [
            avulso && "Horas registradas fora do plantão",
            lancado && "Lançado na plataforma oficial",
          ].filter(Boolean);
          return (
            <button
              key={iso}
              onClick={async () => {
                await db.toggleSobreaviso(iso);
                load();
              }}
              title={dicas.length ? dicas.join(" · ") : undefined}
              className={`day ${on ? "day-on" : avulso ? "day-extra" : ""} ${iso === hoje ? "day-today" : ""}`}
            >
              {lancado && (
                <span className="day-lancado" aria-label="Lançado na plataforma oficial">
                  <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                </span>
              )}
              <span className="font-mono">{d.getDate()}</span>
              {on ? (
                <span className="text-[10px] opacity-80">
                  {tipoDe(iso) === "dia_semana" ? "19–08" : "24h"}
                  {avulso && <span className="ml-1 text-info">●</span>}
                </span>
              ) : (
                avulso && <span className="text-[10px] opacity-80">extra</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Toque em um dia para marcar/desmarcar. Dias úteis: 19h às 08h do dia seguinte. Sábado e
        domingo: 08h às 08h (24h).
      </p>
      <div className="panel mt-4 space-y-3">
        <h2 className="font-mono text-xs tracking-widest text-muted-foreground">LEGENDA</h2>
        <ul className="grid gap-2.5 text-sm sm:grid-cols-2">
          <li className="flex items-center gap-2.5">
            <span className="h-4 w-4 shrink-0 rounded bg-primary" />
            Plantão marcado
          </li>
          <li className="flex items-center gap-2.5">
            <span className="h-4 w-4 shrink-0 rounded bg-info" />
            Horas fora do plantão (ex: trabalho agendado)
          </li>
          <li className="flex items-center gap-2.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-background">
              <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
            </span>
            Dia lançado na plataforma oficial, inclusive plantão sem acionamento
          </li>
          <li className="flex items-center gap-2.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-info" />
            </span>
            Plantão com horas fora do plantão no mesmo dia
          </li>
          <li className="flex items-center gap-2.5">
            <span className="h-4 w-4 shrink-0 rounded ring-2 ring-ring/50" />
            Hoje
          </li>
        </ul>
      </div>
    </Shell>
  );
}
