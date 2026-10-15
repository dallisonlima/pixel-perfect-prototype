import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { ptBR } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toISO } from "@/lib/db";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Seletor de mês no formato "YYYY-MM". */
export function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (mes: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [ano, mes] = value.split("-").map(Number) as [number, number];
  const [anoVisivel, setAnoVisivel] = useState(ano);
  const rotulo = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const hoje = new Date();
  const mudarMes = (delta: number) => {
    const data = new Date(ano, mes - 1 + delta, 1);
    onChange(`${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="picker-nav"
        aria-label="Mês anterior"
        onClick={() => mudarMes(-1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <Popover
        open={aberto}
        onOpenChange={(v) => {
          setAberto(v);
          if (v) setAnoVisivel(ano);
        }}
      >
        <PopoverTrigger asChild>
          <button type="button" className="picker-trigger w-auto capitalize">
            <CalendarDays className="h-4 w-4 text-primary" />
            {rotulo}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="picker-popover w-64">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              className="picker-nav"
              aria-label="Ano anterior"
              onClick={() => setAnoVisivel(anoVisivel - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-mono text-sm font-semibold">{anoVisivel}</span>
            <button
              type="button"
              className="picker-nav"
              aria-label="Próximo ano"
              onClick={() => setAnoVisivel(anoVisivel + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MESES.map((nome, i) => {
              const selecionado = anoVisivel === ano && i + 1 === mes;
              const atual = anoVisivel === hoje.getFullYear() && i === hoje.getMonth();
              return (
                <button
                  key={nome}
                  type="button"
                  className={`picker-month ${selecionado ? "picker-month-on" : ""} ${atual && !selecionado ? "picker-month-today" : ""}`}
                  onClick={() => {
                    onChange(`${anoVisivel}-${String(i + 1).padStart(2, "0")}`);
                    setAberto(false);
                  }}
                >
                  {nome}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        className="picker-nav"
        aria-label="Próximo mês"
        onClick={() => mudarMes(1)}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Data e hora no formato do `datetime-local` ("YYYY-MM-DDTHH:MM"). */
export function DateTimePicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [dia = "", hora = ""] = value.split("T");
  const data = dia ? new Date(`${dia}T00:00`) : undefined;
  const rotulo = data
    ? data.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
    : "Escolher data";

  return (
    <div className="flex gap-2">
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${label}: data`}
            className={`picker-trigger flex-1 ${data ? "" : "text-muted-foreground"}`}
          >
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="capitalize">{rotulo}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="picker-popover w-auto p-0">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={data}
            defaultMonth={data ?? new Date()}
            onSelect={(d) => {
              if (!d) return;
              onChange(`${toISO(d)}T${hora || "00:00"}`);
              setAberto(false);
            }}
            className="rounded-xl"
          />
        </PopoverContent>
      </Popover>
      <label className="picker-trigger w-32 cursor-text">
        <Clock className="h-4 w-4 text-primary" />
        <input
          type="time"
          aria-label={`${label}: hora`}
          className="picker-time"
          value={hora}
          onChange={(e) => onChange(`${dia || toISO(new Date())}T${e.target.value}`)}
        />
      </label>
    </div>
  );
}
