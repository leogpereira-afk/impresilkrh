import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Network, GitBranch, TrendingUp, FileText, UserCircle,
  ShieldCheck, Palmtree, ClipboardList, HardHat, BarChart3, FileSignature,
  Megaphone, Briefcase, SlidersHorizontal, Menu, X, LogOut, Clock, Send, GraduationCap, Lock, Coins, Brain, CalendarDays,
  Sun, Moon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useTema } from "@/lib/tema";
import { NotificacoesButton } from "./notificacoes-button";
import { Logo } from "@/components/brand/logo";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { PERFIL_LABEL } from "@/lib/constants";
import { useSessao } from "@/lib/session";
import { logoutAuth } from "@/lib/auth";
import { useDominio } from "@/lib/dominio";
import { useColecao } from "@/lib/store";
import { modulosLiberados, moduloAcessivel } from "@/lib/rbac";
import { useToast } from "@/components/ui/toast";
import { SyncButton } from "./sync-button";

interface ItemNav {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  perfis: string[];
  grupo: string;
}

const TODOS = ["ADMIN_RH", "GESTOR", "COLABORADOR"];
const GESTAO = ["ADMIN_RH", "GESTOR"];
const RH = ["ADMIN_RH"];

const NAV: ItemNav[] = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard, perfis: TODOS, grupo: "Visão geral" },
  { href: "/calendario", label: "Calendário", icon: CalendarDays, perfis: TODOS, grupo: "Visão geral" },
  // Pessoas — operações do quadro
  { href: "/colaboradores", label: "Colaboradores", icon: Users, perfis: GESTAO, grupo: "Pessoas" },
  { href: "/vagas", label: "Vagas em aberto", icon: Briefcase, perfis: RH, grupo: "Pessoas" },
  { href: "/organograma", label: "Organograma", icon: Network, perfis: TODOS, grupo: "Pessoas" },
  { href: "/desempenho", label: "Desempenho", icon: TrendingUp, perfis: GESTAO, grupo: "Pessoas" },
  { href: "/treinamento", label: "Treinamento", icon: GraduationCap, perfis: GESTAO, grupo: "Pessoas" },
  { href: "/ponto", label: "Frequência e Advertências", icon: Clock, perfis: GESTAO, grupo: "Pessoas" },
  { href: "/ferias", label: "Férias", icon: Palmtree, perfis: GESTAO, grupo: "Pessoas" },
  { href: "/integracao", label: "Onboarding e Offboarding", icon: ClipboardList, perfis: GESTAO, grupo: "Pessoas" },
  { href: "/sst", label: "Saúde e Segurança (SST)", icon: HardHat, perfis: GESTAO, grupo: "Pessoas" },
  // Viagens e Diárias vive dentro de "Custos de Colaboradores" (aba) — só RH.
  // Cargos & Custos — estrutura e dinheiro
  { href: "/carreira", label: "Carreira e Salários", icon: GitBranch, perfis: RH, grupo: "Cargos & Custos" },
  { href: "/custos", label: "Custos de Colaboradores", icon: Coins, perfis: RH, grupo: "Cargos & Custos" },
  // Comunicação & Conteúdo — comunicação interna e material de referência
  { href: "/comunicacao", label: "Comunicação Interna", icon: Megaphone, perfis: TODOS, grupo: "Comunicação & Conteúdo" },
  { href: "/mensagens", label: "Disparo de Mensagens", icon: Send, perfis: GESTAO, grupo: "Comunicação & Conteúdo" },
  { href: "/documentos", label: "Documentos Institucionais", icon: FileText, perfis: TODOS, grupo: "Comunicação & Conteúdo" },
  { href: "/comportamental", label: "Guia Comportamental", icon: Brain, perfis: TODOS, grupo: "Comunicação & Conteúdo" },
  // Administração — só RH
  { href: "/relatorios", label: "Relatórios Gerenciais", icon: BarChart3, perfis: RH, grupo: "Administração" },
  { href: "/aceites", label: "Termos e Aceites", icon: FileSignature, perfis: RH, grupo: "Administração" },
  { href: "/painel-controle", label: "Painel de Controle", icon: SlidersHorizontal, perfis: RH, grupo: "Administração" },
  { href: "/lgpd", label: "Registros de Acesso (LGPD)", icon: ShieldCheck, perfis: RH, grupo: "Administração" },
  // Conta
  { href: "/meu-perfil", label: "Meu perfil", icon: UserCircle, perfis: TODOS, grupo: "Conta" },
];

const GRUPOS = ["Visão geral", "Pessoas", "Cargos & Custos", "Comunicação & Conteúdo", "Administração", "Conta"];

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const sessao = useSessao();
  const { tema, alternar: alternarTema } = useTema();
  const { colabById } = useDominio();
  const { items: usuarios } = useColecao("usuarios");
  const toast = useToast();
  const [aberto, setAberto] = useState(false);

  // Aviso quando o armazenamento do navegador encher (cota do localStorage).
  // Sem isto, gravações falhavam em silêncio e os dados "sumiam" ao recarregar.
  useEffect(() => {
    const aviso = () =>
      toast(
        "Armazenamento do navegador cheio: exporte um backup em Painel de Controle › Marca & Backup e remova arquivos grandes. As últimas alterações podem não ter sido salvas.",
        "erro",
      );
    window.addEventListener("impresilk:armazenamento-cheio", aviso);
    return () => window.removeEventListener("impresilk:armazenamento-cheio", aviso);
  }, [toast]);

  if (!sessao) return null;
  const colab = colabById.get(sessao.colaboradorId);
  const user = { nome: colab?.nome ?? "Usuário", perfil: sessao.perfil };
  // Permissões por módulo (Painel de Controle): além do perfil, respeita o que o
  // RH liberou para cada usuário. null = sem restrição extra.
  const liberados = modulosLiberados(sessao, usuarios);
  const itensVisiveis = NAV.filter(
    (i) => i.perfis.includes(sessao.perfil) && moduloAcessivel(i.href.slice(1), liberados),
  );
  // Bloqueio por URL direta: se o módulo da rota atual não está liberado, nega o acesso.
  const moduloAtual = location.pathname.split("/")[1] || "painel";
  const rotaBloqueada = !moduloAcessivel(moduloAtual, liberados);

  const NavConteudo = () => (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
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
                const ativo = location.pathname === item.href || location.pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    onClick={() => setAberto(false)}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.98]",
                      ativo ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900",
                    )}
                  >
                    <Icon className={cn("h-[18px] w-[18px] shrink-0 transition-colors", ativo ? "text-gold-200" : "text-slate-400 group-hover:text-slate-600")} />
                    <span className="flex-1">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  const Rodape = () => (
    <div className="space-y-2 border-t border-slate-100 p-3">
      <div className="flex items-center gap-3 rounded-lg px-1 py-1.5">
        <Avatar nome={user.nome} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{user.nome}</p>
          <p className="truncate text-xs text-slate-500">{PERFIL_LABEL[user.perfil]}</p>
        </div>
        <button
          onClick={() => {
            logoutAuth();
            navigate("/login");
          }}
          className="btn-ghost p-1.5 text-slate-400 hover:text-red-600"
          title="Sair"
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/70 bg-white/80 backdrop-blur-xl lg:flex">
        <div className="flex h-20 items-center justify-center border-b border-slate-100 px-5">
          <Logo variant="color" className="h-12" />
        </div>
        <NavConteudo />
        <Rodape />
      </aside>

      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm animate-fade-in" onClick={() => setAberto(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-soft animate-scale-in">
            <div className="flex h-20 items-center justify-between border-b border-slate-100 px-5">
              <Logo variant="color" className="h-11" />
              <button onClick={() => setAberto(false)} className="btn-ghost p-1.5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavConteudo />
            <Rodape />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="glass sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/70 px-4 sm:px-6">
          <button onClick={() => setAberto(true)} className="btn-ghost p-1.5 lg:hidden" aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center justify-between">
            <div className="lg:hidden">
              <Logo variant="color" className="h-7" />
            </div>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-800">{user.nome}</p>
                <p className="text-xs text-slate-500">{PERFIL_LABEL[user.perfil]}</p>
              </div>
              <NotificacoesButton />
              <button
                onClick={alternarTema}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.97]"
                title={tema === "escuro" ? "Mudar para tema claro" : "Mudar para tema escuro"}
                aria-label={tema === "escuro" ? "Tema claro" : "Tema escuro"}
              >
                {tema === "escuro" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
              </button>
              {sessao.perfil === "ADMIN_RH" && <SyncButton />}
              <Avatar nome={user.nome} size="sm" />
              <button
                onClick={() => { logoutAuth(); navigate("/login"); }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-all duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-[0.97]"
                title="Sair do sistema"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </header>

        <main key={location.pathname} className="mx-auto w-full max-w-7xl flex-1 animate-fade-in px-4 py-6 sm:px-6 lg:px-8">
          {rotaBloqueada ? (
            <EmptyState
              title="Acesso restrito"
              description="Seu usuário não tem permissão para este módulo. Fale com o RH (Painel de Controle)."
              icon={<Lock className="h-8 w-8" />}
            />
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
