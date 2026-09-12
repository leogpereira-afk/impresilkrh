import { destinosDaBusca } from "@/lib/buscaTelas";
import { Modal } from "@/components/ui/modal";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Network, GitBranch, TrendingUp, FileText, UserCircle,
  ShieldCheck, Palmtree, ClipboardList, HardHat, BarChart3, FileSignature,
  Megaphone, Briefcase, SlidersHorizontal, Menu, X, LogOut, Clock, Send, GraduationCap, Lock, Coins, Brain, CalendarDays, MessageSquare,
  Sun, Moon, ChevronRight, Search,
  Printer, MoreHorizontal,
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
import { modulosLiberados, moduloAcessivel, ehMaster } from "@/lib/rbac";
import { useToast } from "@/components/ui/toast";
import { SyncButton } from "./sync-button";
import { BuscaTelas } from "./busca-telas";
import type { Perfil } from "@/data/types";

interface ItemNav {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  perfis: string[];
  grupo: string;
  destaque?: boolean; // item em evidência no menu (cor âmbar/dourada)
  sub?: boolean; // subitem (indentado sob o item anterior, ex.: sob Colaboradores)
}

const TODOS = ["ADMIN_RH", "GESTOR", "COLABORADOR"];
const GESTAO = ["ADMIN_RH", "GESTOR"];
const RH = ["ADMIN_RH"];

const NAV: ItemNav[] = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard, perfis: TODOS, grupo: "Visão geral" },
  { href: "/calendario", label: "Calendário", icon: CalendarDays, perfis: TODOS, grupo: "Visão geral" },
  // Pessoas — operações do quadro. Desempenho e Treinamento ficam aninhados
  // sob Colaboradores (subitens indentados).
  { href: "/colaboradores", label: "Colaboradores", icon: Users, perfis: GESTAO, grupo: "Pessoas" },
  { href: "/desempenho", label: "Desempenho e desenvolvimento", icon: TrendingUp, perfis: GESTAO, grupo: "Pessoas", sub: true },
  { href: "/feedback", label: "Conversas e feedbacks", icon: MessageSquare, perfis: GESTAO, grupo: "Pessoas", sub: true },
  { href: "/treinamento", label: "Treinamentos", icon: GraduationCap, perfis: GESTAO, grupo: "Pessoas", sub: true },
  { href: "/vagas", label: "Recrutamento e vagas", icon: Briefcase, perfis: RH, grupo: "Pessoas" },
  /* Contratos e participação no quadro são informações distintas. O status
     Freelancer do cadastro continua contando no quadro conforme configuração. */
  { href: "/freelancers", label: "Contratos de freelancer", icon: FileSignature, perfis: RH, grupo: "Pessoas" },
  { href: "/organograma", label: "Organograma", icon: Network, perfis: TODOS, grupo: "Pessoas" },
  { href: "/ponto", label: "Ponto, ausências e advertências", icon: Clock, perfis: GESTAO, grupo: "Pessoas" },
  { href: "/ferias", label: "Férias", icon: Palmtree, perfis: GESTAO, grupo: "Pessoas" },
  { href: "/integracao", label: "Admissão e desligamento", icon: ClipboardList, perfis: GESTAO, grupo: "Pessoas" },
  { href: "/sst", label: "Saúde e segurança", icon: HardHat, perfis: GESTAO, grupo: "Pessoas" },
  // Estrutura e financeiro — estrutura e dinheiro. (A Folha Variável virou aba dentro de
  // "Ponto, ausências e advertências", junto do Ponto do mês.)
  { href: "/cargos", label: "Cargos e responsabilidades", icon: Briefcase, perfis: RH, grupo: "Estrutura e financeiro" },
  { href: "/carreira", label: "Carreira e salários", icon: GitBranch, perfis: RH, grupo: "Estrutura e financeiro" },
  { href: "/custos", label: "Financeiro do RH", icon: Coins, perfis: RH, grupo: "Estrutura e financeiro" },
  // Comunicação e documentos — comunicação interna e material de referência
  { href: "/comunicacao", label: "Comunicação interna", icon: Megaphone, perfis: TODOS, grupo: "Comunicação e documentos" },
  { href: "/mensagens", label: "Mensagens e agendamentos", icon: Send, perfis: GESTAO, grupo: "Comunicação e documentos" },
  { href: "/documentos", label: "Documentos e procedimentos", icon: FileText, perfis: TODOS, grupo: "Comunicação e documentos" },
  { href: "/comportamental", label: "Guia de gestão de pessoas", icon: Brain, perfis: TODOS, grupo: "Comunicação e documentos" },
  // Administração — só RH
  { href: "/relatorios", label: "Relatórios do RH", icon: BarChart3, perfis: RH, grupo: "Administração" },
  { href: "/aceites", label: "Termos e confirmações", icon: FileSignature, perfis: RH, grupo: "Administração" },
  { href: "/painel-controle", label: "Configurações do RH", icon: SlidersHorizontal, perfis: RH, grupo: "Administração" },
  { href: "/lgpd", label: "Histórico de acessos", icon: ShieldCheck, perfis: RH, grupo: "Administração" },
  // Conta
  { href: "/meu-perfil", label: "Meu perfil", icon: UserCircle, perfis: TODOS, grupo: "Conta" },
];

const GRUPOS = ["Visão geral", "Pessoas", "Estrutura e financeiro", "Comunicação e documentos", "Administração", "Conta"];
const EMOJIS: Record<string, string> = {
  painel: "🏠", calendario: "📅", colaboradores: "👥", desempenho: "📈", feedback: "💬", treinamento: "🎓", vagas: "💼", freelancers: "🤝", organograma: "🌳", ponto: "⏰", ferias: "🌴", integracao: "🧭", sst: "🦺", cargos: "🗂️", carreira: "🚀", custos: "💰", comunicacao: "📣", mensagens: "✉️", documentos: "📚", comportamental: "🧠", relatorios: "📊", aceites: "✅", "painel-controle": "⚙️", lgpd: "🔐", "meu-perfil": "👤",
};

/* NAVCONTEUDO E RODAPE MORAM AQUI FORA, e é de propósito.
 *
 * Os dois eram declarados DENTRO do AppShell. Um componente escrito dentro de
 * outro nasce com identidade nova a cada desenho, e o React decide o que
 * reaproveitar comparando o TIPO do elemento: tipo diferente = joga fora e
 * monta de novo. Ou seja, a barra lateral inteira era destruída e refeita o
 * tempo todo — e o <nav> é justamente quem tem a rolagem, com 24 itens em 6
 * grupos no perfil do RH.
 *
 * O AppShell redesenha muito: a cada navegação (useLocation), a cada mudança em
 * colaboradores/cargos/áreas/usuários (inclusive as que a sincronização traz em
 * segundo plano) e a cada grupo recolhido. O efeito para quem usa:
 *
 *  - rolava a barra até "Financeiro do RH" lá embaixo, clicava, e o menu
 *    pulava de volta para o topo — com outro item embaixo do cursor;
 *  - recolher um grupo, que é o recurso feito para encurtar o menu longo,
 *    também jogava a rolagem para o começo;
 *  - quem anda pelo teclado perdia o foco a cada clique: o Tab recomeçava do
 *    topo da página.
 *
 * Medido montando o AppShell de verdade: depois de um clique no menu, o <nav>
 * é OUTRO nó do DOM, a rolagem volta a zero e o foco cai no corpo da página —
 * enquanto <header> e <aside> continuam sendo os mesmos nós, o que isola a
 * causa nesta subárvore.
 *
 * useCallback/useMemo NÃO resolveriam: o problema é o tipo do componente, não
 * uma dependência. Ele precisa ser a mesma função entre um desenho e outro, e
 * é isso que estar no escopo do módulo garante.
 */
function NavConteudo({
  itensVisiveis, recolhidos, alternarGrupo, caminho, aoNavegar,
}: {
  itensVisiveis: ItemNav[];
  recolhidos: Set<string>;
  alternarGrupo: (grupo: string) => void;
  caminho: string;
  aoNavegar: () => void;
}) {
  return (
    <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
      {GRUPOS.map((grupo) => {
        const itens = itensVisiveis.filter((i) => i.grupo === grupo);
        if (!itens.length) return null;
        const recolhido = recolhidos.has(grupo);
        return (
          <div key={grupo}>
            {/* O título do grupo virou botão: em tela baixa (ou com o menu
                inteiro liberado) a barra passa de 20 itens e o rodapé fica
                fora de alcance. Recolher o que não se usa encurta a lista, e
                a escolha fica guardada entre sessões. */}
            <button
              type="button"
              onClick={() => alternarGrupo(grupo)}
              aria-expanded={!recolhido}
              className="nav-section mb-1 flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-xs font-bold uppercase tracking-[0.12em] transition hover:bg-slate-100"
            >
              <ChevronRight className={cn("h-3 w-3 shrink-0 transition-transform duration-200", !recolhido && "rotate-90")} />
              <span className="flex-1 text-left">{grupo}</span>
              {/* Quantos itens sumiram: um grupo recolhido sem contador some da
                  cabeça de quem usa e vira "o sistema perdeu a tela". */}
              {recolhido && <span className="rounded-full bg-slate-100 px-1.5 text-xs tracking-normal text-slate-600">{itens.length}</span>}
            </button>
            <div className={cn("space-y-0.5", recolhido && "hidden")}>
              {itens.map((item) => {
                const ativo = caminho === item.href || caminho.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    onClick={aoNavegar}
                    className={cn(
                      "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-semibold leading-snug transition-all duration-200 active:scale-[0.98]",
                      item.sub && "!pl-7 text-[14px]", // subitem aninhado (ex.: sob Colaboradores)
                      // Sidebar navy: item em destaque = pílula dourada; ativo = realce
                      // claro translúcido; inativo = texto claro com hover suave.
                      item.destaque
                        ? ativo
                          ? "bg-gold-600 text-white shadow-sm"
                          : "bg-gold text-white shadow-sm hover:bg-gold-500"
                        : ativo
                          ? "bg-emerald-50 text-slate-800 shadow-[inset_3px_0_0_#28796a]"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-800",
                    )}
                  >
                    {EMOJIS[item.href.slice(1)] ? <span aria-hidden="true" className="w-5 shrink-0 text-center text-lg">{EMOJIS[item.href.slice(1)]}</span> : <Icon className="h-5 w-5 shrink-0" />}
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
}

function Rodape({ user, aoSair }: {
  user: { nome: string; perfil: Perfil; foto: string | null };
  aoSair: () => void;
}) {
  return (
    <div className="space-y-2 border-t border-slate-200 p-3">
      <div className="flex items-center gap-3 rounded-lg px-1 py-1.5">
        <Avatar nome={user.nome} foto={user.foto} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-700">{user.nome}</p>
          <p className="truncate text-xs text-slate-400">{PERFIL_LABEL[user.perfil]}</p>
        </div>
        <button
          onClick={aoSair}
          className="btn-ghost min-h-11 min-w-11 p-2 text-slate-500 hover:text-red-600"
          title="Sair"
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}

export function AppShell() {
  const [opcoes, setOpcoes] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const sessao = useSessao();
  const { tema, alternar: alternarTema } = useTema();
  const { colabById } = useDominio();
  const { items: usuarios } = useColecao("usuarios");
  const toast = useToast();
  const [aberto, setAberto] = useState(false);
  /* IR PARA UMA TELA DIGITANDO O NOME (Ctrl+K / ⌘K).
     São 25 itens em 6 grupos no perfil do RH, e vários rótulos não são o nome
     que a casa usa — ninguém procura "Ponto, ausências e advertências", procura "o
     ponto". Sem busca, chegar numa tela era rolar a barra e reconhecer. */
  const [buscando, setBuscando] = useState(false);

  // Os grupos abrem expandidos a cada entrada, conforme o padrão do painel.
  // Recolher durante o uso mantém a navegação curta sem esconder links no retorno.
  const [recolhidos, setRecolhidos] = useState<Set<string>>(() => new Set());
  const alternarGrupo = (grupo: string) => setRecolhidos(s => {
    const x = new Set(s); if (x.has(grupo)) x.delete(grupo); else x.add(grupo); return x;
  });
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const nav = document.querySelector<HTMLElement>("[data-menu-rh]");
    nav?.querySelector<HTMLElement>("button, a")?.focus();
    const teclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setAberto(false); }
      if (e.key !== "Tab" || !nav) return;
      const itens = [...nav.querySelectorAll<HTMLElement>("a,button")].filter(el => el.getClientRects().length && !(el as HTMLButtonElement).disabled);
      const primeiro = itens[0], ultimo = itens[itens.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo?.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro?.focus(); }
    };
    document.addEventListener("keydown", teclado);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", teclado); anterior?.focus(); };
  }, [aberto]);

  // Aviso quando o armazenamento do navegador encher (cota do localStorage).
  // Sem isto, gravações falhavam em silêncio e os dados "sumiam" ao recarregar.
  useEffect(() => {
    const aviso = () =>
      toast(
        "Armazenamento do navegador cheio: exporte um backup em Configurações do RH › Marca & Backup e remova arquivos grandes. As últimas alterações podem não ter sido salvas.",
        "erro",
      );
    window.addEventListener("impresilk:armazenamento-cheio", aviso);
    return () => window.removeEventListener("impresilk:armazenamento-cheio", aviso);
  }, [toast]);

  /* O atalho não dispara com o cursor dentro de campo de texto: Ctrl+K em
     alguns teclados/editores é usado para outra coisa, e roubar a tecla de
     quem está escrevendo uma observação seria pior que não ter atalho. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.key === "k" || e.key === "K") || !(e.metaKey || e.ctrlKey)) return;
      const alvo = e.target as HTMLElement | null;
      const tag = alvo?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || alvo?.isContentEditable) return;
      e.preventDefault();
      setBuscando((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!sessao) return null;
  const colab = colabById.get(sessao.colaboradorId);
  const user = { nome: colab?.nome ?? "Usuário", perfil: sessao.perfil, foto: colab?.fotoDataUrl ?? null };
  // Permissões por módulo (Configurações do RH): além do perfil, respeita o que o
  // RH liberou para cada usuário. null = sem restrição extra.
  const liberados = modulosLiberados(sessao, usuarios);
  const itensVisiveis = NAV.filter(
    (i) => i.perfis.includes(sessao.perfil) && moduloAcessivel(i.href.slice(1), liberados),
  );
  // Bloqueio por URL direta: se o módulo da rota atual não está liberado, nega o acesso.
  const moduloAtual = location.pathname.split("/")[1] || "painel";
  const telaAtual = itensVisiveis.find(i => location.pathname === i.href || location.pathname.startsWith(i.href + "/"));
  const rotaBloqueada = !moduloAcessivel(moduloAtual, liberados);

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <aside className="rh-sidebar fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-20 items-center justify-center border-b border-slate-100 px-5">
          <Logo variant="color" className="h-12" />
        </div>
        <NavConteudo itensVisiveis={itensVisiveis} recolhidos={recolhidos} alternarGrupo={alternarGrupo} caminho={location.pathname} aoNavegar={() => setAberto(false)} />
        <Rodape user={user} aoSair={() => { logoutAuth(); navigate("/login"); }} />
      </aside>

      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm animate-fade-in" onClick={() => setAberto(false)} />
          <aside data-menu-rh role="dialog" aria-modal="true" aria-label="Menu do RH" className="rh-sidebar absolute inset-y-0 left-0 flex w-72 max-w-[90vw] flex-col bg-white shadow-soft animate-scale-in">
            <div className="flex h-20 items-center justify-between border-b border-slate-100 px-5">
              <Logo variant="color" className="h-11" />
              <button aria-label="Fechar menu" onClick={() => setAberto(false)} className="btn-ghost min-h-11 min-w-11 p-2 text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavConteudo itensVisiveis={itensVisiveis} recolhidos={recolhidos} alternarGrupo={alternarGrupo} caminho={location.pathname} aoNavegar={() => setAberto(false)} />
            <Rodape user={user} aoSair={() => { logoutAuth(); navigate("/login"); }} />
          </aside>
        </div>
      )}

      {/* Só as telas que este perfil enxerga: a busca não pode revelar a
          existência de uma tela que a pessoa não pode abrir. */}
      <BuscaTelas
        telas={destinosDaBusca(itensVisiveis.map((i) => ({ href: i.href, label: i.label, grupo: i.grupo })), ehMaster(sessao))}
        aberto={buscando}
        onFechar={() => setBuscando(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col lg:pl-72">
        <header className="glass sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/70 px-4 sm:px-6">
          <button onClick={() => setAberto(true)} className="btn-ghost min-h-11 min-w-11 p-1.5 lg:hidden" aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
          {/* A lupa fica ao lado do menu: no celular é o único jeito de chegar
              numa tela sem abrir a gaveta e rolar 25 itens. */}
          <button
            onClick={() => setBuscando(true)}
            className="btn-ghost flex min-h-11 min-w-11 items-center gap-2 px-2 py-1.5 text-slate-500"
            aria-label="Ir para uma tela"
            title="Ir para uma tela (Ctrl+K)"
          >
            <Search className="h-[18px] w-[18px]" />
            <span className="hidden text-sm sm:inline">Buscar no RH</span><kbd className="hidden rounded border border-slate-200 px-1.5 text-[10px] text-slate-400 xl:inline">Ctrl+K</kbd>
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <div className="hidden md:block lg:hidden">
              <Logo variant="color" className="h-7" />
            </div>
            <div className="hidden lg:block" />
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <div className="hidden min-w-0 max-w-44 text-right sm:block">
                <p className="truncate text-sm font-medium text-slate-800" title={user.nome}>{user.nome}</p>
                <p className="text-xs text-slate-500">{PERFIL_LABEL[user.perfil]}</p>
              </div>
              <NotificacoesButton />
              {/* "Salvar PDF" em toda tela (pedido do Léo, 07/09/2026): a
                  impressão do navegador com a folha de estilo de impressão —
                  menu, cabeçalho e botões somem, o conteúdo ocupa a página
                  inteira. "Salvar como PDF" é o destino padrão em qualquer
                  navegador, sem biblioteca e sem tela por tela. */}
              <button
                type="button"
                onClick={() => window.print()}
                className="no-print hidden sm:inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.97]"
                title="Salvar esta tela em PDF (imprimir)"
                aria-label="Salvar em PDF"
              >
                <Printer className="h-[18px] w-[18px]" />
                <span className="hidden xl:inline">PDF</span>
              </button>
              <button
                onClick={alternarTema}
                className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.97]"
                title={tema === "escuro" ? "Mudar para tema claro" : "Mudar para tema escuro"}
                aria-label={tema === "escuro" ? "Tema claro" : "Tema escuro"}
              >
                {tema === "escuro" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
              </button>
              {sessao.perfil === "ADMIN_RH" && <SyncButton />}
              <span className="hidden sm:inline-flex"><Avatar nome={user.nome} foto={user.foto} size="sm" /></span>
              <button
                onClick={() => { logoutAuth(); navigate("/login"); }}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-all duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-[0.97]"
                title="Sair do sistema"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
              <button className="btn-ghost min-h-11 min-w-11 sm:hidden" aria-label="Mais opções" onClick={() => setOpcoes(true)}><MoreHorizontal className="h-5 w-5" /></button>
            </div>
          </div>
        </header>
        <Modal aberto={opcoes} onFechar={() => setOpcoes(false)} titulo="Opções da conta" largura="max-w-sm">
          <p className="mb-3 text-sm">{user.nome} · {PERFIL_LABEL[user.perfil]}</p>
          <div className="grid gap-2">
            <button className="btn-outline min-h-11" onClick={() => { setOpcoes(false); navigate('/meu-perfil'); }}>Meu perfil</button>
            <button className="btn-outline min-h-11" onClick={() => { setOpcoes(false); setTimeout(() => window.print(), 0); }}>Salvar esta tela em PDF</button>
            <button className="btn-outline min-h-11" onClick={alternarTema}>{tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'}</button>
            <button className="btn-outline min-h-11" onClick={() => { setOpcoes(false); logoutAuth(); navigate('/login'); }}>Sair do sistema</button>
          </div>
        </Modal>

        <main id="conteudo-rh" key={location.pathname} className="mx-auto w-full max-w-7xl flex-1 animate-fade-in px-4 py-6 sm:px-6 lg:px-8">
          {telaAtual && <nav aria-label="Localização" className="no-print mb-3 flex items-center gap-1.5 text-xs text-slate-500"><span>{telaAtual.grupo}</span><ChevronRight className="h-3 w-3" /><span className="font-medium text-slate-700">{telaAtual.label}</span></nav>}
          {rotaBloqueada ? (
            <EmptyState
              title="Acesso restrito"
              description="Seu usuário não tem permissão para este módulo. Fale com o RH (Configurações do RH)."
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
