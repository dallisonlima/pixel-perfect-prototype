import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { LogOut, Settings } from "lucide-react";
import { lerBackup } from "@/lib/backup";
import { db } from "@/lib/db";

const links = [
  { to: "/", label: "Painel" },
  { to: "/calendario", label: "Calendário" },
  { to: "/relatorios", label: "Relatórios" },
] as const;

const KEY = "sobreaviso-auth";

function AvisoLocal() {
  return (
    <div className="panel space-y-2 text-sm text-muted-foreground">
      <p>
        Este programa é para uso local neste computador. O usuário e a senha existem apenas para o
        caso de alguém usar este PC sem a sua autorização. Isso não oferece proteções avançadas.
      </p>
      <p>
        Se o cache, os dados do site ou o armazenamento deste navegador forem limpos, o usuário, a
        senha e todos os registros de ponto serão apagados. Em Ajustes dá para baixar uma cópia e
        importar de novo.
      </p>
    </div>
  );
}

function Acesso({ onOk }: { onOk: () => void }) {
  const [modo, setModo] = useState<"setup" | "login" | null>(null);
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let ativo = true;
    db.getUsuario()
      .then((salvo) => {
        if (!ativo) return;
        if (!salvo) window.localStorage.removeItem(KEY);
        setModo(salvo ? "login" : "setup");
      })
      .catch(() => {
        if (ativo) setErro("Não foi possível ler o banco local deste navegador.");
      });
    return () => {
      ativo = false;
    };
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (modo === null || enviando) return;
    const nome = usuario.trim();
    if (!nome || !senha) {
      setErro("Informe usuário e senha.");
      return;
    }
    if (modo === "setup" && senha !== confirmar) {
      setErro("As senhas não coincidem.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      if (modo === "setup") await db.criarUsuario(nome, senha);
      else if (!(await db.verificarLogin(nome, senha))) {
        setErro("Usuário ou senha incorretos.");
        setEnviando(false);
        return;
      }
      window.localStorage.setItem(KEY, "1");
      onOk();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar o usuário.");
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-4">
      <AvisoLocal />
      <form className="panel w-full space-y-4" onSubmit={enviar}>
        <span className="font-mono text-sm tracking-widest text-primary">● SOBREAVISO</span>
        <h1 className="text-2xl font-semibold">
          {modo === "login" ? "Entrar" : modo === "setup" ? "Criar usuário local" : "Sobreaviso"}
        </h1>
        {modo === null ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <input
              className="field"
              placeholder="Usuário"
              autoComplete="username"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
            />
            <input
              className="field"
              type="password"
              placeholder="Senha"
              autoComplete={modo === "setup" ? "new-password" : "current-password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            {modo === "setup" && (
              <input
                className="field"
                type="password"
                placeholder="Confirmar senha"
                autoComplete="new-password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
              />
            )}
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <button type="submit" className="btn-primary w-full" disabled={enviando}>
              {modo === "setup" ? "Criar usuário" : "Entrar"}
            </button>
          </>
        )}
        {modo === null && erro && <p className="text-sm text-destructive">{erro}</p>}
      </form>
    </div>
  );
}

function Ajustes() {
  const [aberto, setAberto] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);

  const baixar = async () => {
    setErro("");
    const dados = await db.exportar();
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ponto-sobreaviso-${dados.exportadoEm.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMsg("Cópia baixada. Guarde o arquivo para restaurar depois.");
  };

  const importar = async (file: File) => {
    setErro("");
    setMsg("");
    try {
      const backup = lerBackup(await file.text());
      const ok = confirm(
        "Isso substitui os plantões, acionamentos e o usuário deste navegador pela cópia do arquivo.",
      );
      if (!ok) return;
      await db.importar(backup);
      window.location.reload();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível importar.");
    }
  };

  return (
    <>
      <button
        type="button"
        className="nav-icon nav-icon-info"
        aria-label="Ajustes"
        onClick={() => setAberto(true)}
      >
        <Settings className="h-4 w-4" />
        <span className="nav-tip" aria-hidden="true">
          Ajustes
        </span>
      </button>
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur">
          <div className="panel w-full max-w-md space-y-4 text-left">
            <h2 className="text-xl font-semibold">Ajustes</h2>
            <p className="text-sm text-muted-foreground">
              Baixe uma cópia para levar os dados a outro navegador ou restaurar depois de limpar o
              cache. O arquivo inclui plantões, acionamentos e o usuário local. A senha em texto não
              entra no arquivo.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={baixar}>
                Baixar dados
              </button>
              <button type="button" className="btn-ghost" onClick={() => arquivo.current?.click()}>
                Importar dados
              </button>
              <input
                ref={arquivo}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void importar(file);
                }}
              />
            </div>
            {msg && <p className="text-sm text-success">{msg}</p>}
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <div className="flex justify-end">
              <button type="button" className="btn-ghost" onClick={() => setAberto(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<boolean | null>(null);
  useEffect(() => {
    let ativo = true;
    db.getUsuario()
      .then((salvo) => {
        if (!ativo) return;
        const sessao = window.localStorage.getItem(KEY) === "1";
        if (!salvo || !sessao) window.localStorage.removeItem(KEY);
        setAuth(Boolean(salvo) && sessao);
      })
      .catch(() => {
        if (ativo) setAuth(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  if (auth === null) return <div className="min-h-screen" />;
  if (!auth) return <Acesso onOk={() => setAuth(true)} />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <span className="font-mono text-sm tracking-widest text-primary">● SOBREAVISO</span>
          <nav className="flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="nav-link"
                activeProps={{ className: "nav-link-active" }}
                activeOptions={{ exact: true }}
              >
                {l.label}
              </Link>
            ))}
            <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
            <Ajustes />
            <button
              type="button"
              className="nav-icon nav-icon-danger"
              aria-label="Sair"
              onClick={() => {
                window.localStorage.removeItem(KEY);
                setAuth(false);
              }}
            >
              <LogOut className="h-4 w-4" />
              <span className="nav-tip" aria-hidden="true">
                Sair
              </span>
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
