import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import {
  LayoutDashboard, Users, Network, GitBranch, TrendingUp, Megaphone, BookOpen,
  FileText, UserCircle, SlidersHorizontal, Menu, X, LogOut, Download, Upload,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Avatar } from "@/components/ui";

const TODOS = ["ADMIN_RH", "GESTOR", "COLABORADOR"];
const GESTAO = ["ADMIN_RH", "GESTOR"];

const NAV = [
  { to: "/", label: "Painel", icon: LayoutDashboard, perfis: TODOS, grupo: "Visão geral", end: true },
  { to: "/colaboradores", label: "Colaboradores", icon: Users, perfis: GESTAO, grupo: "Pessoas" },
  { to: "/organograma", label: "Organograma", icon: Network, perfis: GESTAO, grupo: "Pessoas" },
  { to: "/carreira", label: "Carreira e Salários", icon: GitBranch, perfis: TODOS, grupo: "Pessoas" },
  { to: "/desempenho", label: "Desempenho", icon: TrendingUp, perfis: TODOS, grupo: "Pessoas" },
  { to: "/comunicacao", label: "Comunicação", icon: Megaphone, perfis: TODOS, grupo: "RH" },
  { to: "/pops", label: "POPs e Procedimentos", icon: BookOpen, perfis: TODOS, grupo: "RH" },
  { to: "/documentos", label: "Documentos", icon: FileText, perfis: TODOS, grupo: "RH" },
  { to: "/meu-perfil", label: "Meu perfil", icon: UserCircle, perfis: TODOS, grupo: "Conta" },
  { to: "/painel", label: "Painel de Controle", icon: SlidersHorizontal, perfis: ["ADMIN_RH"], grupo: "Administração" },
];
const GRUPOS = ["Visão geral", "Pessoas", "RH", "Conta", "Administração"];
const PERFIL_LABEL: Record<string, string> = { ADMIN_RH: "Administrador de RH", GESTOR: "Gestor", COLABORADOR: "Colaborador" };

export function Shell({ children }: { children: ReactNode }) {
  const { sessao, sair } = useAuth();
  const { exportar, importar } = useStore();
  const [aberto, setAberto] = useState(false);
  const nav = useNavigate();
  if (!sessao) return null;

  const itens = NAV.filter((i) => i.perfis.includes(sessao.perfil));

  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((t) => {
      if (importar(t)) { alert("Dados importados com sucesso."); location.reload(); }
      else alert("Arquivo inválido.");
    });
  }

  const Sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
        <span className="text-lg font-bold tracking-tight text-white">impresilk<span className="text-gold">.</span></span>
        <span className="ml-1 text-[10px] uppercase tracking-widest text-slate-400">RH</span>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {GRUPOS.map((g) => {
          const list = itens.filter((i) => i.grupo === g);
          if (!list.length) return null;
          return (
            <div key={g}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{g}</p>
              {list.map((i) => {
                const Icon = i.icon;
                return (
                  <NavLink key={i.to} to={i.to} end={i.end} onClick={() => setAberto(false)}
                    className={({ isActive }) => clsx("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                      isActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white")}>
                    <Icon className="h-4 w-4" /> {i.label}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3 space-y-1">
        <button onClick={exportar} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-white/5">
          <Download className="h-4 w-4" /> Exportar dados (.json)
        </button>
        <label className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-white/5">
          <Upload className="h-4 w-4" /> Importar dados
          <input type="file" accept="application/json" className="hidden" onChange={onImport} />
        </label>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-brand-ink lg:block">{Sidebar}</aside>
      {/* Drawer mobile */}
      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAberto(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-brand-ink">{Sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button onClick={() => setAberto(true)} className="btn-ghost p-2 lg:hidden"><Menu className="h-5 w-5" /></button>
          <div className="hidden sm:block" />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{sessao.nome}</p>
              <p className="text-xs text-slate-500">{PERFIL_LABEL[sessao.perfil]}</p>
            </div>
            <Avatar nome={sessao.nome} size="sm" />
            <button onClick={() => { sair(); nav("/login"); }} className="btn-ghost p-2" title="Sair"><LogOut className="h-5 w-5" /></button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
