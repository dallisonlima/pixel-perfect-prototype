import { useState, useMemo } from "react";
import { Copy, Check, Download, X, Calendar, Clock, AlertCircle } from "lucide-react";
import { type Sobreaviso, type Acionamento } from "@/lib/db";
import { gerarEspelhoMes, type PlantaoEspelho } from "@/lib/espelho";

interface EspelhoModalProps {
  sobreavisos: Sobreaviso[];
  acionamentos: Acionamento[];
  mesFormatado: string; // Ex: "2026-10"
  onClose: () => void;
}

export function EspelhoModal({
  sobreavisos,
  acionamentos,
  mesFormatado,
  onClose,
}: EspelhoModalProps) {
  const [copiado, setCopiado] = useState(false);
  const [abaVisualizacao, setAbaVisualizacao] = useState<"texto" | "visual">("texto");

  // Gera o espelho para todos os plantões do mês
  const plantoes: PlantaoEspelho[] = useMemo(() => {
    return gerarEspelhoMes(sobreavisos, acionamentos);
  }, [sobreavisos, acionamentos]);

  // Permite selecionar um plantão específico ou todos
  const [selecao, setSelecao] = useState<string>("todos");

  const plantoesFiltrados = useMemo(() => {
    if (selecao === "todos") return plantoes;
    return plantoes.filter((p) => p.id === selecao);
  }, [plantoes, selecao]);

  // Texto formatado para cópia
  const textoParaCopiar = useMemo(() => {
    if (plantoesFiltrados.length === 0) return "";
    if (plantoesFiltrados.length === 1) {
      return plantoesFiltrados[0]?.textoFormatado ?? "";
    }
    // Múltiplos plantões: separa por cabeçalho claro
    return plantoesFiltrados.map((p) => `--- ${p.titulo} ---\n${p.textoFormatado}`).join("\n\n");
  }, [plantoesFiltrados]);

  const copiarParaTransferencia = async () => {
    if (!textoParaCopiar) return;
    try {
      await navigator.clipboard.writeText(textoParaCopiar);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Fallback simples
      const textArea = document.createElement("textarea");
      textArea.value = textoParaCopiar;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  const baixarTxt = () => {
    if (!textoParaCopiar) return;
    const blob = new Blob([textoParaCopiar], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `espelho-ponto-${selecao === "todos" ? mesFormatado : selecao}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-3 sm:p-4 backdrop-blur">
      <div className="panel flex max-h-[92vh] w-full max-w-2xl flex-col p-0 shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-border p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold leading-tight sm:text-xl">
                Espelho de Ponto (Sobreaviso)
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Relatório contínuo até 23:59 e continuação no dia seguinte às 00:00
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Barra de controle: Seletor de plantão e abas */}
        {plantoes.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border bg-secondary/30 px-4 py-2.5 sm:px-5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Plantão:</span>
              <select
                className="field h-8 w-auto py-1 text-xs sm:text-sm"
                value={selecao}
                onChange={(e) => setSelecao(e.target.value)}
              >
                {plantoes.length > 1 && (
                  <option value="todos">Todos os plantões ({plantoes.length})</option>
                )}
                {plantoes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.dataInicioFormatada} → {p.dataFimFormatada}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAbaVisualizacao("texto")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  abaVisualizacao === "texto"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Texto simples
              </button>
              <button
                type="button"
                onClick={() => setAbaVisualizacao("visual")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  abaVisualizacao === "visual"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Linha do tempo
              </button>
            </div>
          </div>
        )}

        {/* Conteúdo rolável */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {plantoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 rounded-full bg-secondary p-3 text-muted-foreground">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="font-medium">Nenhum plantão encontrado neste mês</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Marque dias de sobreaviso no Calendário ou registre acionamentos neste mês.
              </p>
            </div>
          ) : abaVisualizacao === "texto" ? (
            <div className="space-y-4">
              {plantoesFiltrados.map((p) => (
                <div key={p.id} className="space-y-2">
                  {plantoesFiltrados.length > 1 && (
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-primary">
                        ● {p.titulo}
                      </span>
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(p.textoFormatado);
                          setCopiado(true);
                          setTimeout(() => setCopiado(false), 2000);
                        }}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-3 w-3" /> Copiar este
                      </button>
                    </div>
                  )}
                  <pre className="overflow-x-auto rounded-lg border border-border bg-background/80 p-4 font-mono text-xs leading-relaxed text-foreground sm:text-sm">
                    {p.textoFormatado}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {plantoesFiltrados.map((p) => (
                <div key={p.id} className="rounded-lg border border-border bg-background/50 p-4">
                  <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-2">
                    <h3 className="font-semibold text-primary">{p.titulo}</h3>
                    <span className="font-mono text-xs text-muted-foreground">
                      {p.linhas.filter((l) => l.tipo === "acionamento").length} acionamento(s)
                    </span>
                  </div>

                  <div className="space-y-4">
                    {p.dias.map((d, dIdx) => (
                      <div key={d.data} className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                          <span>
                            {d.dataFormatada} · {d.diaSemana}
                          </span>
                          <span className="font-mono text-[11px]">
                            {dIdx === 0 ? "até 23:59" : "a partir de 00:00"}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {d.linhas.map((l, lIdx) => (
                            <div
                              key={lIdx}
                              className={`flex items-center justify-between rounded-md px-3 py-2 text-xs sm:text-sm ${
                                l.tipo === "acionamento"
                                  ? "border border-primary/30 bg-primary/10 text-primary-foreground font-medium"
                                  : "border border-border/40 bg-secondary/30 text-muted-foreground"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Clock
                                  className={`h-3.5 w-3.5 ${l.tipo === "acionamento" ? "text-primary" : "text-muted-foreground"}`}
                                />
                                <span className="font-mono font-semibold">
                                  {l.inicio} → {l.fim}
                                </span>
                              </div>
                              <span
                                className={
                                  l.tipo === "acionamento"
                                    ? "text-primary font-semibold text-right"
                                    : "text-right"
                                }
                              >
                                {l.descricao}
                              </span>
                            </div>
                          ))}
                        </div>

                        {dIdx === 0 && (
                          <div className="my-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <div className="h-px flex-1 bg-border/60" />
                            <span className="font-mono">
                              🌙 Parada às 23:59 | Continuação às 00:00
                            </span>
                            <div className="h-px flex-1 bg-border/60" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé com ações */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-secondary/20 p-4 sm:p-5">
          <button
            type="button"
            className="btn-ghost flex items-center gap-1.5 text-xs sm:text-sm"
            onClick={baixarTxt}
            disabled={plantoesFiltrados.length === 0}
          >
            <Download className="h-4 w-4" /> Baixar TXT
          </button>

          <div className="flex gap-2">
            <button type="button" className="btn-ghost text-xs sm:text-sm" onClick={onClose}>
              Fechar
            </button>
            <button
              type="button"
              className="btn-primary flex items-center gap-1.5 text-xs sm:text-sm"
              onClick={copiarParaTransferencia}
              disabled={plantoesFiltrados.length === 0}
            >
              {copiado ? (
                <>
                  <Check className="h-4 w-4 text-success" /> Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copiar relatório
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
