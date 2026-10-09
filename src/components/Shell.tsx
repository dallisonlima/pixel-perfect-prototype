import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

const links = [
  { to: "/", label: "Painel" },
  { to: "/calendario", label: "Calendário" },
  { to: "/relatorios", label: "Relatórios" },
] as const;

const KEY = "sobreaviso-auth";

function Login({ onOk }: { onOk: () => void }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState(false);
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        className="panel w-full max-w-sm space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (u === "admin" && p === "admin") { localStorage.setItem(KEY, "1"); onOk(); }
          else setErr(true);
        }}
      >
        <span className="font-mono text-sm tracking-widest text-primary">● SOBREAVISO</span>
        <h1 className="text-2xl font-semibold">Entrar</h1>
        <input className="field" placeholder="Usuário" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} />
        <input className="field" type="password" placeholder="Senha" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} />
        {err && <p className="text-sm text-destructive">Usuário ou senha incorretos.</p>}
        <button type="submit" className="btn-primary w-full">Entrar</button>
      </form>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<boolean | null>(null);
  useEffect(() => { setAuth(localStorage.getItem(KEY) === "1"); }, []);

  if (auth === null) return <div className="min-h-screen" />;
  if (!auth) return <Login onOk={() => setAuth(true)} />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <span className="font-mono text-sm tracking-widest text-primary">● SOBREAVISO</span>
          <nav className="flex items-center gap-1">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="nav-link" activeProps={{ className: "nav-link-active" }} activeOptions={{ exact: true }}>
                {l.label}
              </Link>
            ))}
            <button className="nav-link" onClick={() => { localStorage.removeItem(KEY); setAuth(false); }}>Sair</button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
