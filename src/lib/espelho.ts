import { tipoDe, parseDate, toISO, type Sobreaviso, type Acionamento } from "./db";

export interface LinhaEspelho {
  inicio: string; // "18:00"
  fim: string; // "18:50"
  descricao: string; // "Sobreaviso" ou justificativa
  tipo: "sobreaviso" | "acionamento";
  texto: string; // "18:00 -> 18:50 = Sobreaviso"
}

export interface DiaEspelho {
  data: string; // "YYYY-MM-DD"
  dataFormatada: string; // "08/10/2026"
  diaSemana: string; // "Quinta-feira"
  linhas: LinhaEspelho[];
}

export interface PlantaoEspelho {
  id: string;
  dataPlantao: string; // "2026-10-08"
  dataInicioFormatada: string; // "08/10/2026"
  dataFimFormatada: string; // "09/10/2026"
  titulo: string; // "Plantão de 08/10/2026 a 09/10/2026"
  dias: DiaEspelho[];
  linhas: LinhaEspelho[];
  textoFormatado: string;
}

export function fmtMinute(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function gerarIntervalosDoDia(
  dayStartMin: number,
  dayEndMin: number,
  acionamentos: Array<{ start: number; end: number; desc: string }>,
): LinhaEspelho[] {
  const result: LinhaEspelho[] = [];
  let cursor = dayStartMin;

  const ordenados = [...acionamentos].sort((a, b) => a.start - b.start);

  for (const act of ordenados) {
    const actStart = Math.max(act.start, cursor);
    const actEnd = Math.min(act.end, dayEndMin);
    if (actStart > actEnd) continue;

    // Se há espaço antes do acionamento, cria faixa de Sobreaviso
    if (actStart > cursor) {
      const inicio = fmtMinute(cursor);
      const fim = fmtMinute(actStart - 1);
      const descricao = "Sobreaviso";
      result.push({
        inicio,
        fim,
        descricao,
        tipo: "sobreaviso",
        texto: `${inicio} -> ${fim} = ${descricao}`,
      });
    }

    // Faixa do acionamento
    const inicio = fmtMinute(actStart);
    const fim = fmtMinute(actEnd);
    const descricao = act.desc.trim() || "Acionamento";
    result.push({
      inicio,
      fim,
      descricao,
      tipo: "acionamento",
      texto: `${inicio} -> ${fim} = ${descricao}`,
    });

    cursor = actEnd + 1;
    if (cursor > dayEndMin) break;
  }

  // Faixa restante de Sobreaviso até o final do período do dia
  if (cursor <= dayEndMin) {
    const inicio = fmtMinute(cursor);
    const fim = fmtMinute(dayEndMin);
    const descricao = "Sobreaviso";
    result.push({
      inicio,
      fim,
      descricao,
      tipo: "sobreaviso",
      texto: `${inicio} -> ${fim} = ${descricao}`,
    });
  }

  return result;
}

const DIAS_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function formatarDataBR(d: Date): string {
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

export function gerarEspelhoPlantao(
  sobreaviso: Sobreaviso,
  todosAcionamentos: Acionamento[],
): PlantaoEspelho {
  const d1 = parseDate(sobreaviso.data);
  const tipo = tipoDe(sobreaviso.data);

  const d1Start = new Date(d1);
  d1Start.setHours(tipo === "dia_semana" ? 18 : 8, 0, 0, 0);

  const midnight = new Date(d1);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);

  const d2End = new Date(midnight);
  d2End.setHours(8, 0, 0, 0);

  const d2Date = new Date(midnight);

  // Filtra acionamentos concluídos pertencentes a este plantão
  const acs = todosAcionamentos.filter((a) => {
    if (!a.fim_acionamento) return false;
    if (a.sobreaviso_id === sobreaviso.id) return true;
    return a.inicio_acionamento >= d1Start.getTime() && a.inicio_acionamento < d2End.getTime();
  });

  const day1StartMin = tipo === "dia_semana" ? 18 * 60 : 8 * 60;
  const day1EndMin = 23 * 60 + 59; // 23:59

  const day2StartMin = 0; // 00:00
  const day2EndMin = 7 * 60 + 59; // 07:59

  const day1Acs: Array<{ start: number; end: number; desc: string }> = [];
  const day2Acs: Array<{ start: number; end: number; desc: string }> = [];

  for (const ac of acs) {
    const acIni = new Date(ac.inicio_acionamento);
    const acFim = new Date(ac.fim_acionamento!);

    // Parte no Dia 1
    if (acIni.getTime() < midnight.getTime() && acFim.getTime() > d1Start.getTime()) {
      const startMin =
        acIni.getTime() <= d1Start.getTime()
          ? day1StartMin
          : acIni.getHours() * 60 + acIni.getMinutes();

      const endMin =
        acFim.getTime() >= midnight.getTime()
          ? day1EndMin
          : acFim.getHours() * 60 + acFim.getMinutes();

      day1Acs.push({ start: startMin, end: endMin, desc: ac.justificativa });
    }

    // Parte no Dia 2
    if (acFim.getTime() > midnight.getTime() && acIni.getTime() < d2End.getTime()) {
      const startMin =
        acIni.getTime() <= midnight.getTime() ? 0 : acIni.getHours() * 60 + acIni.getMinutes();

      const endMin =
        acFim.getTime() >= d2End.getTime()
          ? day2EndMin
          : acFim.getHours() * 60 + acFim.getMinutes();

      day2Acs.push({ start: startMin, end: endMin, desc: ac.justificativa });
    }
  }

  const linhasDia1 = gerarIntervalosDoDia(day1StartMin, day1EndMin, day1Acs);
  const linhasDia2 = gerarIntervalosDoDia(day2StartMin, day2EndMin, day2Acs);

  const dias: DiaEspelho[] = [
    {
      data: sobreaviso.data,
      dataFormatada: formatarDataBR(d1),
      diaSemana: DIAS_SEMANA[d1.getDay()] ?? "",
      linhas: linhasDia1,
    },
    {
      data: toISO(d2Date),
      dataFormatada: formatarDataBR(d2Date),
      diaSemana: DIAS_SEMANA[d2Date.getDay()] ?? "",
      linhas: linhasDia2,
    },
  ];

  const todasLinhas = [...linhasDia1, ...linhasDia2];
  const textoFormatado = todasLinhas.map((l) => l.texto).join("\n");

  return {
    id: sobreaviso.id,
    dataPlantao: sobreaviso.data,
    dataInicioFormatada: formatarDataBR(d1),
    dataFimFormatada: formatarDataBR(d2Date),
    titulo: `Plantão de ${formatarDataBR(d1)} a ${formatarDataBR(d2Date)}`,
    dias,
    linhas: todasLinhas,
    textoFormatado,
  };
}

export function gerarEspelhoMes(
  sobreavisos: Sobreaviso[],
  todosAcionamentos: Acionamento[],
): PlantaoEspelho[] {
  // Ordena por data crescente
  const ordenados = [...sobreavisos].sort((a, b) => a.data.localeCompare(b.data));
  return ordenados.map((s) => gerarEspelhoPlantao(s, todosAcionamentos));
}
