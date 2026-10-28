import {
  tipoDe,
  parseDate,
  toISO,
  janela,
  plantaoDoAcionamento,
  type Sobreaviso,
  type Acionamento,
} from "./db";

export interface LinhaEspelho {
  inicio: string; // "19:00"
  fim: string; // "18:50"
  descricao: string; // "Sobreaviso" ou justificativa
  tipo: "sobreaviso" | "acionamento";
  texto: string; // "19:00 -> 19:50 = Sobreaviso"
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
  foraDoPlantao: boolean;
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
  d1Start.setHours(tipo === "dia_semana" ? 19 : 8, 0, 0, 0);

  const midnight = new Date(d1);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);

  const d2End = new Date(midnight);
  d2End.setHours(8, 0, 0, 0);

  const d2Date = new Date(midnight);

  // Só acionamentos que começam dentro deste plantão. Os demais vão para o bloco fora do plantão.
  const acs = todosAcionamentos.filter(
    (a) =>
      a.fim_acionamento !== null &&
      a.inicio_acionamento >= d1Start.getTime() &&
      a.inicio_acionamento < d2End.getTime(),
  );

  const day1StartMin = tipo === "dia_semana" ? 19 * 60 : 8 * 60;
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
    foraDoPlantao: false,
  };
}

function linhaTrabalhada(inicio: Date, fim: Date, desc: string): LinhaEspelho {
  const ini = fmtMinute(inicio.getHours() * 60 + inicio.getMinutes());
  const acabouNaVirada =
    fim.getHours() === 0 && fim.getMinutes() === 0 && fim.getSeconds() === 0 && fim > inicio;
  const fimMin = acabouNaVirada ? 23 * 60 + 59 : fim.getHours() * 60 + fim.getMinutes();
  const horaFim = fmtMinute(fimMin);
  const descricao = desc.trim() || "Acionamento";
  return {
    inicio: ini,
    fim: horaFim,
    descricao,
    tipo: "acionamento",
    texto: `${ini} -> ${horaFim} = ${descricao}`,
  };
}

// Quebra na meia-noite no mesmo formato do plantão (23:59 e continua 00:00), sem faixas de sobreaviso.
function trechosTrabalhados(inicioMs: number, fimMs: number, desc: string) {
  const partes: { data: string; linha: LinhaEspelho }[] = [];
  let cursor = new Date(inicioMs);
  const fim = new Date(fimMs);
  while (cursor < fim) {
    const virada = new Date(cursor);
    virada.setDate(virada.getDate() + 1);
    virada.setHours(0, 0, 0, 0);
    const ate = fim < virada ? fim : virada;
    partes.push({ data: toISO(cursor), linha: linhaTrabalhada(cursor, ate, desc) });
    cursor = ate;
  }
  return partes;
}

export function gerarEspelhoForaDoPlantao(
  sobreavisos: Sobreaviso[],
  todosAcionamentos: Acionamento[],
): PlantaoEspelho[] {
  const grupos = new Map<
    string,
    { ordem: number; partes: { data: string; linha: LinhaEspelho }[] }
  >();

  const avulsos = todosAcionamentos
    .filter((ac) => ac.fim_acionamento && !plantaoDoAcionamento(sobreavisos, ac))
    .sort((a, b) => a.inicio_acionamento - b.inicio_acionamento);

  for (const ac of avulsos) {
    const dia = toISO(new Date(ac.inicio_acionamento));
    const grupo = grupos.get(dia) ?? { ordem: ac.inicio_acionamento, partes: [] };
    grupo.ordem = Math.min(grupo.ordem, ac.inicio_acionamento);
    grupo.partes.push(
      ...trechosTrabalhados(ac.inicio_acionamento, ac.fim_acionamento!, ac.justificativa),
    );
    grupos.set(dia, grupo);
  }

  return [...grupos.entries()]
    .sort(([, a], [, b]) => a.ordem - b.ordem)
    .map(([dia, grupo]) => {
      const datas = [...new Set(grupo.partes.map((p) => p.data))].sort();
      const dias: DiaEspelho[] = datas.map((data) => {
        const d = parseDate(data);
        return {
          data,
          dataFormatada: formatarDataBR(d),
          diaSemana: DIAS_SEMANA[d.getDay()] ?? "",
          linhas: grupo.partes.filter((p) => p.data === data).map((p) => p.linha),
        };
      });
      const linhas = dias.flatMap((d) => d.linhas);
      const inicio = dias[0]!;
      const ultimo = dias[dias.length - 1]!;
      const titulo =
        datas.length > 1
          ? `Fora do plantão de ${inicio.dataFormatada} a ${ultimo.dataFormatada}`
          : `Fora do plantão · ${inicio.dataFormatada}`;
      return {
        id: `fora-${dia}`,
        dataPlantao: dia,
        dataInicioFormatada: inicio.dataFormatada,
        dataFimFormatada: ultimo.dataFormatada,
        titulo,
        dias,
        linhas,
        textoFormatado: linhas.map((l) => l.texto).join("\n"),
        foraDoPlantao: true,
      };
    });
}

// `mes` ("YYYY-MM") limita os plantões e o trabalho fora do plantão ao mês do relatório.
// A classificação usa todos os plantões, para não confundir a madrugada de um plantão do mês anterior.
export function gerarEspelhoMes(
  sobreavisos: Sobreaviso[],
  todosAcionamentos: Acionamento[],
  mes?: string,
): PlantaoEspelho[] {
  const doMes = (iso: string) => !mes || iso.startsWith(mes);
  const plantoes = [...sobreavisos]
    .filter((s) => doMes(s.data))
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((s) => ({
      ordem: janela(s.data).inicio.getTime(),
      espelho: gerarEspelhoPlantao(s, todosAcionamentos),
    }));
  const fora = gerarEspelhoForaDoPlantao(sobreavisos, todosAcionamentos)
    .filter((espelho) => doMes(espelho.dataPlantao))
    .map((espelho) => ({
      ordem: parseDate(espelho.dataPlantao).getTime(),
      espelho,
    }));
  // Fora do plantão no mesmo dia civil vem antes do plantão, que começa à noite.
  return [...plantoes, ...fora].sort((a, b) => a.ordem - b.ordem).map((x) => x.espelho);
}
