import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Network,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Users,
  UserPlus,
  UserMinus,
  Camera,
  Pencil,
  Building2,
  GitBranch,
  LayoutGrid,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Campo, Input, Select } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { ColaboradorForm } from "@/components/colaboradores/colaborador-form";
import { useColecao } from "@/lib/store";
import { comprimirImagem } from "@/lib/imagem";
import { vinculosDoColaborador, resumirVinculos } from "@/lib/vinculos";
import { diaLocalISO } from "@/lib/format";
import { HOJE } from "@/data/_gen";
import { useDominio, noQuadro } from "@/lib/dominio";
import { LinkFicha } from "@/components/ui/link-ficha";
import { useSessao } from "@/lib/session";
import { idsDaEquipe, ehRH } from "@/lib/rbac";
import { useToast } from "@/components/ui/toast";
import { slug } from "@/data/_gen";
import { cn } from "@/lib/cn";
import type { Colaborador } from "@/data/types";
import { removerSenhaUsuario } from "@/lib/auth";

type Visao = "hierarquia" | "area" | "empresa";

// Mantém a lógica de papéis do organograma, agora aplicada como um indicador
// colorido (ponto/faixa lateral) por se tratar de uma linha e não mais de um card.
function corNode(c: Colaborador, ehGer: boolean): { dot: string; rotulo: string } {
  if (!c.gestorId && c.ehDirecao) return { dot: "bg-green-600", rotulo: "Fundador(a)" };
  if (c.cargoLivre === "Diretor Geral") return { dot: "bg-brand", rotulo: "Diretoria" };
  if (c.statusId === "externo") return { dot: "bg-slate-300", rotulo: "Assessoria externa" };
  if (ehGer) return { dot: "bg-teal-500", rotulo: "Gestor(a) / Líder" };
  return { dot: "bg-slate-300", rotulo: "Equipe" };
}

/* AS DUAS LINHAS DO ORGANOGRAMA MORAM AQUI FORA, e é de propósito.
 *
 * `Node` e `LinhaPessoa` eram declarados DENTRO do Organograma. Componente
 * escrito dentro de outro nasce com identidade nova a cada desenho, e o React
 * decide o que reaproveitar comparando o TIPO do elemento: tipo diferente = joga
 * fora e monta de novo. A `key` não salva — ela só desempata entre irmãos do
 * MESMO tipo.
 *
 * E `Node` é recursivo: ele se chama para cada subordinado. Então qualquer
 * clique — abrir um ramo, recolher, trocar a visão, marcar "só ativos", ou uma
 * sincronização chegando em segundo plano — destruía e refazia a árvore INTEIRA,
 * com as fotos (data URL) redecodificadas todas de novo. Numa base de ~92
 * pessoas isso engasga em máquina de chão de fábrica.
 *
 * Pelo teclado ficava pior que lento: o botão recém-clicado deixava de existir,
 * o foco caía no corpo da página e o Tab recomeçava do topo — não dava para
 * abrir dois ramos seguidos.
 *
 * A regra react/no-unstable-nested-components (eslint.config.mjs) agora barra a
 * volta disso em todo o sistema.
 */
interface AcoesOrg {
  podeEditar: boolean;
  nomeCargo: (c: Colaborador) => string;
  ehGerente: (c: Colaborador) => boolean;
  onEditar: (c: Colaborador) => void;
  onAdicionar: (c: Colaborador) => void;
  onFoto: (id: string) => void;
  onRemover: (c: Colaborador) => void;
}

// Cada nó é uma linha (estilo explorador de arquivos): a indentação por nível
// vem do aninhamento dos <ul>, cada um com uma guia vertical à esquerda
// conectando pais e filhos. Expandir/recolher por ramo. Nunca há sobreposição:
// a árvore cresce apenas verticalmente.
function Node({ c, filhosPorGestor, colapsados, toggle, acoes }: {
  c: Colaborador;
  filhosPorGestor: Map<string, Colaborador[]>;
  colapsados: Set<string>;
  toggle: (id: string) => void;
  acoes: AcoesOrg;
}) {
  const filhos = filhosPorGestor.get(c.id) ?? [];
  const temFilhos = filhos.length > 0;
  const cor = corNode(c, acoes.ehGerente(c));
  const colapsado = colapsados.has(c.id);

  return (
    <li>
      <div className="group flex items-center gap-2 rounded-lg py-1.5 pl-1 pr-2 transition hover:bg-slate-50">
        {/* Chevron de expandir/recolher (ocupa espaço fixo mesmo sem filhos) */}
        {temFilhos ? (
          <button
            type="button"
            onClick={() => toggle(c.id)}
            title={colapsado ? "Expandir" : "Recolher"}
            aria-label={colapsado ? `Expandir equipe de ${c.nome}` : `Recolher equipe de ${c.nome}`}
            aria-expanded={!colapsado}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600"
          >
            {colapsado ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0" aria-hidden />
        )}

        {/* Indicador colorido de papel (faixa lateral) */}
        <span className={cn("h-7 w-1 shrink-0 rounded-full", cor.dot)} title={cor.rotulo} aria-hidden />

        {/* Foto (cai nas iniciais quando não há) */}
        <Avatar nome={c.nome} foto={c.fotoDataUrl} size="sm" className="ring-1 ring-slate-200" />

        {/* Nome + cargo (clicar navega para a ficha) */}
        <Link to={`/colaboradores/${c.id}`} className="min-w-0 flex-1" title={`Abrir ficha de ${c.nome}`}>
          <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-brand">{c.nome}</p>
          <p className="truncate text-[11px] text-slate-400">{acoes.nomeCargo(c)}</p>
        </Link>

        {/* Badge de subordinados diretos */}
        {temFilhos && (
          <Badge variant="neutral" className="shrink-0">
            {filhos.length} {filhos.length === 1 ? "direto" : "diretos"}
          </Badge>
        )}

        {/* Ações de RH (aparecem no hover quando podeEditar) */}
        {acoes.podeEditar && (
          <div className="flex shrink-0 gap-0.5 opacity-100 transition sm:opacity-0 focus-within:opacity-100 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => acoes.onEditar(c)}
              title="Editar colaborador"
              aria-label={`Editar ${c.nome}`}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-brand"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => acoes.onAdicionar(c)}
              title="Adicionar subordinado"
              aria-label={`Adicionar subordinado a ${c.nome}`}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-brand"
            >
              <UserPlus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => acoes.onFoto(c.id)}
              title="Enviar foto"
              aria-label={`Enviar foto de ${c.nome}`}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-brand"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => acoes.onRemover(c)}
              title="Remover do organograma"
              aria-label={`Remover ${c.nome} do organograma`}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-red-600"
            >
              <UserMinus className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Filhos: container indentado com guia vertical (a indentação se acumula
          pelo aninhamento dos <ul>) */}
      {temFilhos && !colapsado && (
        <ul className="ml-4 border-l border-slate-200 pl-1.5">
          {filhos.map((f) => (
            <Node key={f.id} c={f} filhosPorGestor={filhosPorGestor} colapsados={colapsados} toggle={toggle} acoes={acoes} />
          ))}
        </ul>
      )}
    </li>
  );
}

// Linha de pessoa para as visões agrupadas (por área / por empresa) — sem árvore.
function LinhaPessoa({ c, visao, nomeArea, acoes }: {
  c: Colaborador;
  visao: string;
  nomeArea: (id?: string | null) => string;
  acoes: AcoesOrg;
}) {
  const cor = corNode(c, acoes.ehGerente(c));
  return (
    <div className="group flex items-center gap-2 rounded-lg border border-slate-100 p-2 transition hover:bg-slate-50">
      <span className={cn("h-7 w-1 shrink-0 rounded-full", cor.dot)} title={cor.rotulo} aria-hidden />
      <Avatar nome={c.nome} foto={c.fotoDataUrl} size="sm" className="ring-1 ring-slate-200" />
      <Link to={`/colaboradores/${c.id}`} className="min-w-0 flex-1" title={`Abrir ficha de ${c.nome}`}>
        <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-brand">{c.nome}</p>
        <p className="truncate text-[11px] text-slate-400">{acoes.nomeCargo(c)}{visao === "area" && c.empresa ? ` · ${c.empresa}` : ""}{visao === "empresa" ? ` · ${nomeArea(c.areaId)}` : ""}</p>
      </Link>
      {acoes.podeEditar && (
        <div className="flex shrink-0 gap-0.5 opacity-100 transition sm:opacity-0 focus-within:opacity-100 group-hover:opacity-100">
          <button type="button" onClick={() => acoes.onEditar(c)} title="Editar colaborador" aria-label={`Editar ${c.nome}`} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-brand"><Pencil className="h-4 w-4" /></button>
          <button type="button" onClick={() => acoes.onFoto(c.id)} title="Enviar foto" aria-label={`Enviar foto de ${c.nome}`} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-brand"><Camera className="h-4 w-4" /></button>
          <button type="button" onClick={() => acoes.onRemover(c)} title="Remover do organograma" aria-label={`Remover ${c.nome}`} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-red-600"><UserMinus className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}

export default function Organograma() {
  const sessao = useSessao();
  const d = useDominio();
  const toast = useToast();
  const { criar, atualizar, remover } = useColecao("colaboradores");
  const { criar: criarMov } = useColecao("movimentacoes");
  const { items: usuarios, atualizar: atualizarUsuario } = useColecao("usuarios");
  const podeEditar = ehRH(sessao);

  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const [mostrarPainel, setMostrarPainel] = useState(false);
  const [adicionarEm, setAdicionarEm] = useState<Colaborador | null>(null);
  const [removerAlvo, setRemoverAlvo] = useState<Colaborador | null>(null);
  const [editarAlvo, setEditarAlvo] = useState<Colaborador | null>(null);
  const [visao, setVisao] = useState<Visao>("hierarquia");
  const [soAtivos, setSoAtivos] = useState(true);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const fotoAlvoRef = useRef<string | null>(null);

  // Filtro "só ativos" (desligados/inativos fora) — padrão do sistema.
  const visiveis = useMemo(() => (soAtivos ? d.colaboradores.filter(noQuadro) : d.colaboradores), [d.colaboradores, soAtivos]);
  const visIds = useMemo(() => new Set(visiveis.map((c) => c.id)), [visiveis]);

  // Pai EFETIVO: ao ocultar inativos, quem ficou sem gestor sobe na cadeia até o
  // primeiro gestor visível — mantém a árvore conectada.
  const paiEfetivo = useMemo(() => {
    const cache = new Map<string, string | null>();
    for (const c of visiveis) {
      let g = c.gestorId ?? null;
      while (g && !visIds.has(g)) g = d.colabById.get(g)?.gestorId ?? null;
      cache.set(c.id, g && visIds.has(g) ? g : null);
    }
    return cache;
  }, [visiveis, visIds, d.colabById]);

  const filhosPorGestor = useMemo(() => {
    const m = new Map<string, Colaborador[]>();
    for (const c of visiveis) {
      const p = paiEfetivo.get(c.id);
      if (p) { const arr = m.get(p) ?? []; arr.push(c); m.set(p, arr); }
    }
    return m;
  }, [visiveis, paiEfetivo]);

  const raizes = useMemo(() => visiveis.filter((c) => !paiEfetivo.get(c.id)), [visiveis, paiEfetivo]);

  // Agrupamentos para as visões "Por área" e "Por empresa".
  const porArea = useMemo(() => {
    return d.areas
      .map((a) => ({ chave: a.id, titulo: a.nome, pessoas: visiveis.filter((c) => c.areaId === a.id).sort((x, y) => x.nome.localeCompare(y.nome)) }))
      .filter((g) => g.pessoas.length > 0);
  }, [d.areas, visiveis]);
  const porEmpresa = useMemo(() => {
    const mapa = new Map<string, Colaborador[]>();
    for (const c of visiveis) { const e = c.empresa || "Sem empresa"; (mapa.get(e) ?? mapa.set(e, []).get(e)!).push(c); }
    return [...mapa.entries()].map(([titulo, pessoas]) => ({ chave: titulo, titulo, pessoas: pessoas.sort((x, y) => x.nome.localeCompare(y.nome)) })).sort((a, b) => a.titulo.localeCompare(b.titulo));
  }, [visiveis]);

  const ehGerente = (c: Colaborador) => (filhosPorGestor.get(c.id)?.length ?? 0) > 0 && !c.ehDirecao;

  const toggle = (id: string) =>
    setColapsados((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const expandirTudo = () => setColapsados(new Set());
  // Recolher tudo: colapsa todos os nós que possuem subordinados.
  const recolherTudo = () => setColapsados(new Set(filhosPorGestor.keys()));


  // Vínculos da pessoa apontada para exclusão (folha, documentos, férias...).
  // É o que decide se dá para apagar de verdade ou se o certo é desligar.
  // Sem memo de propósito: só roda quando o aviso está aberto (uma pessoa por vez)
  // e precisa refletir o estado do momento em que a decisão é tomada.
  const vinculosAlvo = removerAlvo ? vinculosDoColaborador(removerAlvo.id) : null;
  // O que segura a exclusão: registro DA PESSOA ou conta de login. Trilha não
  // segura — ela aponta para quem saiu de propósito. Escrito assim (e não como
  // soma de `?? 0`) porque é este `&&` que faz o TypeScript saber, lá embaixo,
  // que `vinculosAlvo` não é nulo quando `resumirVinculos` é chamado.
  const alvoTemHistorico = !!vinculosAlvo && (vinculosAlvo.total > 0 || vinculosAlvo.contas > 0);

  // Tira a pessoa do organograma.
  //
  // ANTES isto APAGAVA a pessoa inteira — e o aviso só dizia "remover do
  // organograma". A folha, os documentos, as férias e as avaliações dela
  // continuavam no sistema apontando para um id inexistente (registros órfãos,
  // invisíveis nas telas mas ainda somando nos totais).
  //
  // Agora: quem tem histórico é DESLIGADO (sai do quadro, o histórico fica
  // inteiro e pode ser reativado). Só some de vez quem não tem nada pendurado
  // — o caso do cadastro criado por engano.
  const removerDoOrganograma = async (c: Colaborador) => {
    const v = vinculosDoColaborador(c.id);
    // Subordinados passam a se reportar ao gestor de quem saiu (nos dois casos).
    const filhos = d.colaboradores.filter((x) => x.gestorId === c.id);
    for (const f of filhos) atualizar(f.id, { gestorId: c.gestorId ?? null });
    const reposicionados = filhos.length > 0 ? ` ${filhos.length} subordinado(s) reposicionado(s).` : "";

    // Conta de login também segura a exclusão: apagar a ficha deixaria a linha
    // de `usuarios` apontando para um id morto — login que entra e tela que não
    // acha o nome. Trilha (acessos, alterações) NÃO segura: ela é append-only e
    // continua apontando para quem saiu de propósito.
    if (v.total > 0 || v.contas > 0) {
      atualizar(c.id, { statusId: "inativo", dataDesligamento: c.dataDesligamento ?? diaLocalISO(HOJE) });
      criarMov({
        colaboradorId: c.id,
        tipo: "Afastamento",
        data: diaLocalISO(HOJE),
        descricao: "Saída registrada pelo organograma.",
        registradoPor: "RH",
      });
      // Desligar pelo organograma deixava o login vivo: no dia seguinte a
      // pessoa entrava e via a equipe. O mesmo fecho da ficha, aqui também.
      const conta = usuarios.find((u) => u.colaboradorId === c.id && u.ativo);
      if (conta) {
        atualizarUsuario(conta.id, { ativo: false });
        try { await removerSenhaUsuario({ colaboradorId: c.id }); }
        catch { toast("Saída registrada, mas não deu para revogar o acesso no servidor agora. Refaça em Configurações do RH quando estiver online.", "erro"); }
      }
      toast(`${c.nome} saiu do quadro. O histórico foi preservado.${reposicionados}`);
    } else {
      // Sem histórico: some de vez, mas antes limpa quem apontava para ela.
      for (const x of d.colaboradores.filter((p) => p.padrinhoId === c.id)) atualizar(x.id, { padrinhoId: null });
      remover(c.id);
      toast(`${c.nome} foi excluído(a) do cadastro.${reposicionados}`);
    }
    setRemoverAlvo(null);
  };

  // Upload de foto (≤ 1 MB) → data URL → atualiza o colaborador.
  const abrirSeletorFoto = (id: string) => {
    fotoAlvoRef.current = id;
    fotoInputRef.current?.click();
  };

  /* O que as linhas do organograma precisam para agir. Vai como VALOR, não como
     tipo de componente: um objeto novo a cada desenho é inofensivo — quem
     causava a remontagem era o componente estar declarado aqui dentro. */
  const acoes: AcoesOrg = {
    podeEditar,
    nomeCargo: (c) => d.nomeCargo(c),
    ehGerente,
    onEditar: setEditarAlvo,
    onAdicionar: setAdicionarEm,
    onFoto: abrirSeletorFoto,
    onRemover: setRemoverAlvo,
  };

  const aoSelecionarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = fotoAlvoRef.current;
    e.target.value = ""; // permite reenviar o mesmo arquivo
    if (!file || !id) return;
    if (!file.type.startsWith("image/")) {
      toast("Selecione um arquivo de imagem.", "erro");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast("Imagem muito grande. Escolha uma de até 8 MB.", "erro");
      return;
    }
    try {
      const thumb = await comprimirImagem(file);
      atualizar(id, { fotoDataUrl: thumb });
      toast("Foto atualizada.");
    } catch {
      toast("Não foi possível processar a imagem.", "erro");
    }
  };

  const grupos = visao === "area" ? porArea : porEmpresa;

  return (
    <div>
      <PageHeader title="Organograma" description="Estrutura da Impresilk — veja por hierarquia, área ou empresa, e edite na própria tela.">
        {visao === "hierarquia" && (
          <>
            <button className="btn-outline" onClick={expandirTudo}>
              <ChevronsUpDown className="h-4 w-4" /> Expandir tudo
            </button>
            <button className="btn-outline" onClick={recolherTudo}>
              <ChevronsDownUp className="h-4 w-4" /> Recolher tudo
            </button>
          </>
        )}
        {podeEditar && (
          <button className="btn-outline" onClick={() => setMostrarPainel((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" /> {mostrarPainel ? "Ocultar" : "Editar hierarquia"}
          </button>
        )}
      </PageHeader>

      {/* Seletor de visão + filtro de ativos */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {([["hierarquia", "Hierarquia", GitBranch], ["area", "Por área", LayoutGrid], ["empresa", "Por empresa", Building2]] as const).map(([v, label, Icone]) => (
            <button
              key={v}
              type="button"
              onClick={() => setVisao(v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                visao === v ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}
            >
              <Icone className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600" title="Por padrão o organograma mostra só os ativos">
          <input
            type="checkbox"
            checked={!soAtivos}
            onChange={(e) => setSoAtivos(!e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
          />
          Incluir inativos
        </label>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-xs text-slate-500">
        <Legenda cor="bg-green-600" label="Fundadores" />
        <Legenda cor="bg-brand" label="Diretoria" />
        <Legenda cor="bg-teal-500" label="Gestores / Líderes" />
        <Legenda cor="bg-slate-300" label="Assessorias (externas)" />
        <Legenda cor="bg-white border border-slate-300" label="Equipe" />
      </div>

      {visao === "hierarquia" ? (
        <Card>
          <CardBody>
            {/* overflow-x-auto só atua como rede de segurança em telas muito estreitas */}
            <div className="overflow-x-auto">
              <ul className="min-w-[280px]">
                {raizes.length > 0 ? raizes.map((c) => <Node key={c.id} c={c} filhosPorGestor={filhosPorGestor} colapsados={colapsados} toggle={toggle} acoes={acoes} />) : <p className="text-sm text-slate-500">Nenhum colaborador para mostrar.</p>}
              </ul>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <Card key={g.chave}>
              <CardHeader title={g.titulo} subtitle={`${g.pessoas.length} pessoa(s)`} icon={visao === "area" ? <LayoutGrid className="h-[18px] w-[18px]" /> : <Building2 className="h-[18px] w-[18px]" />} />
              <CardBody className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {g.pessoas.map((c) => <LinhaPessoa key={c.id} c={c} visao={visao} nomeArea={(id) => d.nomeArea(id)} acoes={acoes} />)}
              </CardBody>
            </Card>
          ))}
          {grupos.length === 0 && <Card><CardBody><p className="text-sm text-slate-500">Nenhum colaborador para mostrar.</p></CardBody></Card>}
        </div>
      )}

      {mostrarPainel && podeEditar && <PainelHierarquia />}

      {podeEditar && (
        <>
          <input
            ref={fotoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={aoSelecionarFoto}
          />
          {/* Edição completa do colaborador (cargo, nível, gestor, dados...) */}
          {editarAlvo && (
            <ColaboradorForm aberto onFechar={() => setEditarAlvo(null)} editar={editarAlvo} />
          )}
          {adicionarEm && (
            <ModalAdicionarSubordinado
              gestor={adicionarEm}
              onFechar={() => setAdicionarEm(null)}
              onCriar={(dados) => {
                const id = slug(dados.nome) || `colab_${Date.now().toString(36)}`;
                if (d.colabById.has(id)) {
                  toast("Já existe uma pessoa com esse nome. Ajuste o nome.", "erro");
                  return;
                }
                criar({
                  id,
                  nome: dados.nome,
                  areaId: dados.areaId || null,
                  cargoId: dados.cargoId || null,
                  nivelId: dados.nivelId || null,
                  gestorId: adicionarEm.id,
                  statusId: "ativo",
                  perfil: "COLABORADOR",
                });
                toast(`${dados.nome} adicionado(a) sob ${adicionarEm.nome}.`);
                setAdicionarEm(null);
              }}
            />
          )}
          {removerAlvo && (
            <ConfirmDialog
              aberto
              onFechar={() => setRemoverAlvo(null)}
              onConfirmar={() => removerDoOrganograma(removerAlvo)}
              titulo={alvoTemHistorico ? "Tirar do quadro" : "Excluir do cadastro"}
              textoConfirmar={alvoTemHistorico ? "Tirar do quadro" : "Excluir"}
              mensagem={
                <>
                  {vinculosAlvo && alvoTemHistorico ? (
                    <>
                      <strong>{removerAlvo.nome}</strong> tem histórico no sistema:{" "}
                      {resumirVinculos(vinculosAlvo)}.
                      <br />
                      <br />
                      Por isso ela <strong>não será apagada</strong>: passa a Inativo e sai do quadro,
                      guardando tudo. Se voltar, é só reativar na ficha.
                    </>
                  ) : (
                    <>
                      <strong>{removerAlvo.nome}</strong> não tem nenhum registro de pessoa no sistema, então será{" "}
                      <strong>excluída do cadastro</strong>. Isso não tem volta.
                      {vinculosAlvo && vinculosAlvo.trilha > 0 && (
                        <> As {vinculosAlvo.trilha} linha(s) de trilha (quem abriu a ficha, o que foi
                        alterado) ficam onde estão: trilha não se reescreve.</>
                      )}
                    </>
                  )}
                  {(filhosPorGestor.get(removerAlvo.id)?.length ?? 0) > 0 && (
                    <>
                      {" "}Os {filhosPorGestor.get(removerAlvo.id)!.length} subordinado(s) direto(s)
                      passarão a se reportar ao gestor atual desta pessoa.
                    </>
                  )}
                </>
              }
            />
          )}
        </>
      )}
    </div>
  );
}

function ModalAdicionarSubordinado({
  gestor,
  onFechar,
  onCriar,
}: {
  gestor: Colaborador;
  onFechar: () => void;
  onCriar: (dados: { nome: string; areaId: string; cargoId: string; nivelId: string }) => void;
}) {
  const d = useDominio();
  const toast = useToast();
  const [nome, setNome] = useState("");
  const [areaId, setAreaId] = useState(gestor.areaId ?? "");
  const [cargoId, setCargoId] = useState("");
  const [nivelId, setNivelId] = useState("");

  const cargosDaArea = useMemo(
    () => d.cargos.filter((c) => !areaId || c.areaId === areaId),
    [d.cargos, areaId],
  );

  const salvar = () => {
    if (!nome.trim()) {
      toast("Informe o nome da pessoa.", "erro");
      return;
    }
    onCriar({ nome: nome.trim(), areaId, cargoId, nivelId });
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Adicionar subordinado"
      descricao={`Nova pessoa reportando-se a ${gestor.nome}.`}
      rodape={
        <>
          <button className="btn-outline" onClick={onFechar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={salvar}>
            <UserPlus className="h-4 w-4" /> Adicionar
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Campo label="Nome" obrigatorio>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome completo"
            autoFocus
          />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Área">
            <Select
              value={areaId}
              onChange={(e) => {
                setAreaId(e.target.value);
                setCargoId("");
              }}
            >
              <option value="">— selecione —</option>
              {d.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Cargo">
            <Select value={cargoId} onChange={(e) => setCargoId(e.target.value)}>
              <option value="">— selecione —</option>
              {cargosDaArea.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
        <Campo label="Nível">
          <Select value={nivelId} onChange={(e) => setNivelId(e.target.value)}>
            <option value="">— selecione —</option>
            {d.niveis.map((n) => (
              <option key={n.id} value={n.id}>
                {n.codigo} — {n.nome}
              </option>
            ))}
          </Select>
        </Campo>
      </div>
    </Modal>
  );
}

function Legenda({ cor, label }: { cor: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded", cor)} /> {label}
    </span>
  );
}

function PainelHierarquia() {
  const toast = useToast();
  const d = useDominio();
  const { atualizar } = useColecao("colaboradores");

  const alterarGestor = (c: Colaborador, novoGestor: string) => {
    // Proteção a ciclos: o novo gestor não pode ser o próprio nem um subordinado.
    if (novoGestor) {
      const subordinados = idsDaEquipe(c.id, d.colaboradores);
      if (subordinados.includes(novoGestor)) {
        toast("Operação inválida: criaria um ciclo na hierarquia.", "erro");
        return;
      }
    }
    atualizar(c.id, { gestorId: novoGestor || null });
    toast(`Gestor de ${c.nome} atualizado.`);
  };

  const ordenados = [...d.colaboradores].sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <Card className="mt-6">
      <CardHeader title="Painel de hierarquia" subtitle="Redefina a quem cada pessoa se reporta (com proteção a ciclos)." icon={<Network className="h-[18px] w-[18px]" />} />
      <CardBody>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ordenados.map((c) => {
            const subordinados = new Set(idsDaEquipe(c.id, d.colaboradores));
            return (
              <div key={c.id} className="rounded-lg border border-slate-100 p-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" />
                  <p className="truncate text-sm font-medium text-slate-700"><LinkFicha id={c.id} titulo="Abrir a ficha antes de trocar o gestor">{c.nome}</LinkFicha></p>
                  {c.ehDirecao && <Badge variant="neutral">Direção</Badge>}
                </div>
                <Select value={c.gestorId ?? ""} onChange={(e) => alterarGestor(c, e.target.value)}>
                  <option value="">— topo (sem gestor) —</option>
                  {d.colaboradores
                    .filter((g) => g.id !== c.id && !subordinados.has(g.id))
                    .map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </Select>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
