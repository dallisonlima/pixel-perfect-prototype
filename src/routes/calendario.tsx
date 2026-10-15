import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

function Calendario() {
  const [ref, setRef] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [avulsos, setAvulsos] = useState<Set<string>>(new Set());
  const load = async () => {
    const [s, a] = await Promise.all([db.allSobreavisos(), db.allAcionamentos()]);
    setMarcados(new Set(s.map((x) => x.data)));
    setAvulsos(
      new Set(a.filter((x) => !plantaoDoAcionamento(s, x)).map((x) => diaDoAcionamento(s, x))),
    );
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
          return (
            <button
              key={iso}
              onClick={async () => {
                await db.toggleSobreaviso(iso);
                load();
              }}
              title={avulso ? "Horas registradas fora do plantão" : undefined}
              className={`day ${on ? "day-on" : avulso ? "day-extra" : ""} ${iso === hoje ? "day-today" : ""}`}
            >
              <span className="font-mono">{d.getDate()}</span>
              {on ? (
                <span className="text-[10px] opacity-80">
                  {tipoDe(iso) === "dia_semana" ? "18–08" : "24h"}
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
        Toque em um dia para marcar/desmarcar. Dias úteis: 18h às 08h do dia seguinte. Sábado e
        domingo: 08h às 08h (24h).
      </p>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-primary" /> Plantão marcado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-info" /> Horas fora do plantão (ex: trabalho
          agendado)
        </span>
      </div>
    </Shell>
  );
}
