"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/misc";
import { PERFIL_LABEL } from "@/lib/constants";
import { sair } from "@/lib/actions";
import {
  LayoutDashboard,
  Users,
  Network,
  GitBranch,
  TrendingUp,
  FileText,
  UserCircle,
  Settings,
  ShieldCheck,
  Plane,
  Palmtree,
  ClipboardList,
  HardHat,
  BarChart3,
  Bell,
  FileSignature,
  Menu,
  X,
  LogOut,
} from "lucide-react";

interface ItemNav {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  perfis: string[];
  grupo: string;
  badge?: string;
}

const TODOS = ["ADMIN_RH", "GESTOR", "COLABORADOR"];
const GESTAO = ["ADMIN_RH", "GESTOR"];

const NAV: ItemNav[] = [
  { href: "/dashboard", label: "Painel inicial", icon: LayoutDashboard, perfis: TODOS, grupo: "Visão geral" },
  { href: "/colaboradores", label: "Colaboradores", icon: Users, perfis: GESTAO, grupo: "Pessoas" },
  { href: "/organograma", label: "Organograma", icon: Network, perfis: GESTAO, grupo: "Pessoas" },
  { href: "/ferias", label: "Férias", icon: Palmtree, perfis: GESTAO, grupo: "Pessoas" },
  { href: "/integracao", label: "Integração / Desligamento", icon: ClipboardList, perfis: GESTAO, grupo: "Pessoas" },
  { href: "/carreira", label: "Carreira e Salários", icon: GitBranch, perfis: TODOS, grupo: "Pessoas" },
  { href: "/desempenho", label: "Desempenho", icon: TrendingUp, perfis: TODOS, grupo: "Pessoas" },
  { href: "/viagens", label: "Viagens e Diárias", icon: Plane, perfis: GESTAO, grupo: "Pessoas" },
  { href: "/sst", label: "Saúde e Segurança (SST)", icon: HardHat, perfis: GESTAO, grupo: "Conhecimento" },
  { href: "/documentos", label: "Documentos Institucionais", icon: FileText, perfis: TODOS, grupo: "Conhecimento" },
  { href: "/meu-perfil", label: "Meu perfil", icon: UserCircle, perfis: TODOS, grupo: "Conta" },
  { href: "/aceites", label: "Termos e Aceites", icon: FileSignature, perfis: TODOS, grupo: "Conta" },
  { href: "/notificacoes", label: "Notificações", icon: Bell, perfis: TODOS, grupo: "Conta" },
  { href: "/relatorios", label: "Relatórios Gerenciais", icon: BarChart3, perfis: ["ADMIN_RH"], grupo: "Administração" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, perfis: ["ADMIN_RH"], grupo: "Administração" },
  { href: "/lgpd", label: "Registros de Acesso (LGPD)", icon: ShieldCheck, perfis: ["ADMIN_RH"], grupo: "Administração" },
];

const GRUPOS = ["Visão geral", "Pessoas", "Conhecimento", "Conta", "Administração"];

export function AppShell({
  user,
  children,
  naoLidas = 0,
}: {
  user: { nome: string; perfil: string; email: string };
  children: React.ReactNode;
  naoLidas?: number;
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);

  const itensVisiveis = NAV.filter((i) => i.perfis.includes(user.perfil));

  const NavConteudo = () => (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {GRUPOS.map((grupo) => {
        const itens = itensVisiveis.filter((i) => i.grupo === grupo);
        if (!itens.length) return null;
        return (
          <div key={grupo}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {grupo}
            </p>
            <div className="space-y-0.5">
              {itens.map((item) => {
                const ativo =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setAberto(false)}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                      ativo
                        ? "bg-brand text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        ativo ? "text-gold-200" : "text-slate-400 group-hover:text-slate-600",
                      )}
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="rounded-full bg-gold-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gold-700">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-100 px-5">
          <Logo variant="dark" />
        </div>
        <NavConteudo />
        <RodapeUsuario user={user} />
      </aside>

      {/* Drawer mobile */}
      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm"
            onClick={() => setAberto(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl animate-fade-in">
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
              <Logo variant="dark" />
              <button onClick={() => setAberto(false)} className="btn-ghost p-1.5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavConteudo />
            <RodapeUsuario user={user} />
          </aside>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setAberto(true)}
            className="btn-ghost p-1.5 lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center justify-between">
            <div className="lg:hidden">
              <Logo variant="dark" showTagline={false} />
            </div>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-3">
              <Link
                href="/notificacoes"
                className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                title="Notificações"
              >
                <Bell className="h-5 w-5" />
                {naoLidas > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {naoLidas > 9 ? "9+" : naoLidas}
                  </span>
                )}
              </Link>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-800">{user.nome}</p>
                <p className="text-xs text-slate-500">{PERFIL_LABEL[user.perfil]}</p>
              </div>
              <Avatar nome={user.nome} size="sm" />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function RodapeUsuario({ user }: { user: { nome: string; perfil: string } }) {
  return (
    <div className="border-t border-slate-100 p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <Avatar nome={user.nome} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{user.nome}</p>
          <p className="truncate text-xs text-slate-500">{PERFIL_LABEL[user.perfil]}</p>
        </div>
        <form action={sair}>
          <button
            type="submit"
            className="btn-ghost p-1.5 text-slate-400 hover:text-red-600"
            title="Sair"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </form>
      </div>
    </div>
  );
}
