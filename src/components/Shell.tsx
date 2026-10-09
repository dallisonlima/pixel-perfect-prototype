import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const links = [
  { to: "/", label: "Painel" },
  { to: "/calendario", label: "Calendário" },
  { to: "/relatorios", label: "Relatórios" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <span className="font-mono text-sm tracking-widest text-primary">● SOBREAVISO</span>
          <nav className="flex gap-1">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="nav-link" activeProps={{ className: "nav-link-active" }} activeOptions={{ exact: true }}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
