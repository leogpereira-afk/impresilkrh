/* O FREELANCER NAS DUAS PONTAS: a ficha que ainda não tem contrato, e o
 * contrato que não aparecia em Colaboradores.
 *
 * Há dois jeitos de alguém ser freelancer no RH, e até 30/09/2026 eles não se
 * enxergavam:
 *
 *   1. a FICHA em Colaboradores com a situação "freelancer" (empreita, sem
 *      carteira): quem deixou de ser CLT e continua trabalhando. Ela conta no
 *      quadro, com card próprio (pedido do Léo de 08/09);
 *   2. o CONTRATO de freelancer (coleção `freelancers`, tela Freelancers): o
 *      prestador que não entra no quadro, na folha nem no organograma.
 *
 * O PCP junta os dois pelo CPF inteiro: com a ficha na situação freelancer e
 * um contrato ativo do mesmo CPF, vale o contrato. Então a ficha sem contrato é
 * uma pendência (o PCP não tem o combinado nem a data que fecha o acesso), e o
 * contrato sem ficha é gente que trabalha e que a tela de Colaboradores não
 * mostrava. Decisões do Léo de 30/09/2026:
 *
 *   A. a tela de Freelancers lista as fichas de situação freelancer que ainda
 *      não têm contrato, com um botão que abre o formulário JÁ PREENCHIDO. Nada
 *      é gravado sozinho: quem salva é o botão da tela, pela régua de CPF;
 *   B. Colaboradores, no filtro Freelancer, mostra também os contratos ativos,
 *      em linha própria, FORA de toda contagem do quadro. O card da situação
 *      ganha "+N por contrato" para o número de cima não contradizer a lista.
 *
 * As regras moram aqui, puras e com teste, porque são três telas lendo a mesma
 * resposta (a lista, o card e os arquivos exportados) e as três precisam
 * concordar sobre quem é a mesma pessoa.
 */
import type { Colaborador, Freelancer } from "@/data/types";
import { noQuadro } from "./dominio";
import { cpfPendente, idDoContrato, soDigitosCpf } from "./freelancerContrato";

/** O id do status "Freelancer" no cadastro de situações (o do Osmane). */
export const STATUS_FREELANCER = "freelancer";

/** O Status que a linha de contrato leva na lista e nos arquivos exportados. */
export const STATUS_DO_CONTRATO = "Freelancer (contrato)";

type ContratoMinimo = Pick<Freelancer, "situacao" | "contratoFim">;

/**
 * O contrato vale HOJE? Não é encerrado e a data de fim não passou.
 *
 * O vencido fica de fora de propósito: é a data que fecha o acesso nos
 * sistemas, então passou dela a pessoa já não entra, e mostrá-la entre os
 * freelancers do quadro seria afirmar que ela trabalha. O aviso de contrato
 * vencido mora na tela de Freelancers, que é onde se renova. Contrato antigo
 * sem data (anterior à data obrigatória) conta como vigente: lá ele aparece
 * como "sem prazo", em vermelho.
 */
export function contratoVigente(f: ContratoMinimo | null | undefined, hoje: string): boolean {
  if (!f || f.situacao === "encerrado") return false;
  const fim = String(f.contratoFim ?? "").slice(0, 10);
  return !fim || fim >= hoje;
}

/**
 * Esta ficha e este contrato são a mesma pessoa?
 *
 * O CPF manda: é por ele que o PCP junta os dois (só dígitos, para "300.005.987-39"
 * e "30000598739" serem o mesmo). Quando os dois têm CPF, só ele decide, e CPFs
 * diferentes são pessoas diferentes mesmo que o contrato tenha nascido da ficha.
 * Quando falta CPF de um lado, vale a origem: o contrato criado pelo botão
 * "Criar contrato" guarda `exColaboradorId`, e sem isso uma ficha sem CPF
 * continuaria "sem contrato" depois de o contrato existir, e apareceria duas
 * vezes na lista de Colaboradores.
 */
export function mesmaPessoa(
  ficha: Pick<Colaborador, "id" | "cpf">,
  contrato: Pick<Freelancer, "cpf" | "exColaboradorId">,
): boolean {
  const a = soDigitosCpf(ficha.cpf);
  const b = soDigitosCpf(contrato.cpf);
  if (a && b) return a === b;
  return !!contrato.exColaboradorId && contrato.exColaboradorId === ficha.id;
}

/**
 * As fichas de situação freelancer, não desligadas, que ainda não têm contrato.
 *
 * Qualquer contrato conta, ativo ou encerrado: quem já tem um contrato
 * encerrado não precisa de outro criado do zero, precisa que alguém reabra o
 * que existe. O bloco pede o contrato que falta, não o que venceu.
 */
export function fichasSemContrato(
  colaboradores: Colaborador[],
  contratos: Pick<Freelancer, "cpf" | "exColaboradorId">[],
): Colaborador[] {
  return colaboradores
    .filter((c) => !c.ehDirecao && c.statusId === STATUS_FREELANCER && noQuadro(c))
    .filter((c) => !contratos.some((f) => mesmaPessoa(c, f)))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * O rascunho do contrato a partir da ficha, para o formulário da tela.
 *
 * É só rascunho: sem `id` (a tela cria, não atualiza) e sem gravar nada. A
 * função fica em branco de propósito, para o Léo escolher: é ela que decide se
 * o CPF é obrigatório (instalador), e chutar "Instalador" faria a régua cobrar
 * CPF de quem talvez não instale. A data de fim também fica em branco: é ela
 * que fecha o acesso, e não cabe a um botão inventá-la.
 */
export function contratoDaFicha(ficha: Colaborador, hoje: string): Partial<Freelancer> {
  const t = (v: unknown) => String(v ?? "").trim();
  return {
    nome: t(ficha.nome),
    apelido: t(ficha.apelido),
    cpf: t(ficha.cpf),
    cnpj: "",
    telefone: t(ficha.telefone),
    email: t(ficha.email),
    funcao: "",
    contratoInicio: hoje,
    contratoFim: "",
    valor: undefined,
    formaPagamento: "",
    responsavelId: "",
    exColaboradorId: ficha.id,
    situacao: "ativo",
    observacoes: "",
  };
}

export interface ContratosNaLista {
  /** Ficha da lista → o contrato vigente dela (a linha ganha a tag "Contrato"). */
  comContrato: Map<string, Freelancer>;
  /** Contratos vigentes sem ficha na lista: cada um vira uma linha própria. */
  avulsos: Freelancer[];
}

/**
 * Junta os contratos vigentes às fichas que a lista está mostrando.
 *
 * NUNCA A MESMA PESSOA DUAS VEZES. O contrato da mesma pessoa de uma ficha da
 * lista não vira linha: vira a tag na linha da ficha. O que sobra vira linha
 * própria, um por pessoa: dois contratos vigentes do mesmo CPF (renovação
 * lançada sem encerrar o anterior) viram uma linha só, a do fim mais distante.
 *
 * A junção é com a lista MOSTRADA, não com o cadastro inteiro: se a ficha está
 * fora da lista (desligada, ou em outra situação), o contrato vigente aparece
 * sozinho, porque é ele que diz que a pessoa trabalha hoje.
 */
export function juntarContratos(
  fichas: Pick<Colaborador, "id" | "cpf">[],
  contratos: Freelancer[],
  hoje: string,
): ContratosNaLista {
  const comContrato = new Map<string, Freelancer>();
  const porPessoa = new Map<string, Freelancer>();
  const fimDe = (f: Freelancer) => String(f.contratoFim ?? "").slice(0, 10) || "9999-12-31";
  for (const f of contratos) {
    if (!contratoVigente(f, hoje)) continue;
    const ficha = fichas.find((c) => mesmaPessoa(c, f));
    if (ficha) {
      const atual = comContrato.get(ficha.id);
      if (!atual || fimDe(f) > fimDe(atual)) comContrato.set(ficha.id, f);
      continue;
    }
    const chave = soDigitosCpf(f.cpf) || `id:${f.id}`;
    const atual = porPessoa.get(chave);
    if (!atual || fimDe(f) > fimDe(atual)) porPessoa.set(chave, f);
  }
  const avulsos = [...porPessoa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { comContrato, avulsos };
}

/**
 * O "+N por contrato" do card Freelancer.
 *
 * É a quantidade de linhas de contrato que a lista mostra no filtro Freelancer
 * sem outro recorte: a junção com as fichas freelancer do quadro (as mesmas
 * que o filtro lista, sem desligados e sem a Direção). Contrato da mesma pessoa
 * de uma dessas fichas não soma: ela já está no número do card.
 */
export function contratosForaDoCard(
  escopo: Colaborador[],
  contratos: Freelancer[],
  hoje: string,
): number {
  const fichas = escopo.filter((c) => !c.ehDirecao && noQuadro(c) && c.statusId === STATUS_FREELANCER);
  return juntarContratos(fichas, contratos, hoje).avulsos.length;
}

/**
 * A lista está só na situação Freelancer? Vale pelo filtro de situação (e pela
 * URL /colaboradores?status=freelancer) e pelo card Freelancer. Se qualquer um
 * dos dois pede outra coisa (outro status, Indisponíveis), não é o filtro
 * Freelancer, e contrato nenhum entra.
 */
export function soFiltroFreelancer(fStatus: string, foco: string | null): boolean {
  const pedidos = [fStatus, foco?.startsWith("st:") ? foco.slice(3) : foco].filter((x): x is string => !!x);
  return pedidos.length > 0 && pedidos.every((p) => p === STATUS_FREELANCER);
}

/** A busca da tela, aplicada ao contrato: nome, apelido, função e e-mail. */
export function contratoNaBusca(f: Freelancer, termo: string): boolean {
  const t = termo.trim().toLowerCase();
  if (!t) return true;
  return [f.nome, f.apelido, f.funcao, f.email].some((v) => String(v ?? "").toLowerCase().includes(t));
}

/** "até 31/12/2026", ou "" sem data de fim. Sem fuso: a data é o dia gravado. */
export function ateQuando(f: Pick<Freelancer, "contratoFim">): string {
  const s = String(f.contratoFim ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [a, m, d] = s.split("-");
  return `até ${d}/${m}/${a}`;
}

/** O resumo do contrato numa célula: prazo e, se faltar, o CPF pendente. */
export function resumoDoContrato(f: Freelancer): string {
  return [ateQuando(f), cpfPendente(f) ? "CPF pendente" : ""].filter(Boolean).join(" · ");
}

/**
 * A célula da coluna "Contrato de freelancer" nos arquivos: "Contrato até
 * 31/12/2026 · CPF pendente". Começa sempre por "Contrato", para a ficha que
 * tem contrato sem data de fim não ficar com a célula em branco, que é o que
 * a ficha sem contrato mostra. É a tag "Contrato" da tela, por escrito.
 */
export function celulaDoContrato(f: Freelancer): string {
  return ["Contrato", resumoDoContrato(f)].filter(Boolean).join(" ");
}

const SEM_CONTRATOS: ContratosNaLista & { foraDoRecorte: number } = { comContrato: new Map(), avulsos: [], foraDoRecorte: 0 };

/** O que a tela de Colaboradores precisa para desenhar a lista. */
export interface PedidoDaTela {
  /** podeVerContratosFreelancer: a mesma guarda da rota /freelancers. */
  podeVer: boolean;
  fStatus: string;
  foco: string | null;
  /** As fichas que a lista está mostrando, já filtradas e ordenadas. */
  lista: Pick<Colaborador, "id" | "cpf">[];
  contratos: Freelancer[];
  hoje: string;
  busca: string;
  /** Algum chip de área marcado: contrato não tem área, então não entra. */
  comArea: boolean;
}

/**
 * Os contratos que a lista de Colaboradores mostra, e a tag das fichas.
 *
 * Só no filtro Freelancer e só para quem abre /freelancers: nos outros filtros,
 * em "Todos" e para os outros perfis, nada muda (nem a tag, que também revela
 * que existe um contrato). A busca vale para o contrato como vale para a ficha;
 * a área não, porque contrato não tem área, e marcar um setor é dizer "só
 * quem é deste setor". `foraDoRecorte` é quantos a busca ou a área tiraram:
 * o PDF conta, para não passar por lista inteira.
 */
export function contratosDaTela(p: PedidoDaTela): ContratosNaLista & { foraDoRecorte: number } {
  if (!p.podeVer || !soFiltroFreelancer(p.fStatus, p.foco)) return SEM_CONTRATOS;
  const j = juntarContratos(p.lista, p.contratos, p.hoje);
  const avulsos = p.comArea ? [] : j.avulsos.filter((f) => contratoNaBusca(f, p.busca));
  return { comContrato: j.comContrato, avulsos, foraDoRecorte: j.avulsos.length - avulsos.length };
}

/** A coluna que os arquivos ganham quando a lista mostra contrato. */
export const COLUNA_CONTRATO = "Contrato de freelancer";

/**
 * A linha de contrato nos arquivos, pelo nome da coluna.
 *
 * Só o que o contrato tem: nome, contato, a função (no lugar do cargo, como a
 * tela mostra) e o Status "Freelancer (contrato)". O resto sai VAZIO, e não
 * com traço: área, nível, admissão e uniforme não existem no contrato, e o
 * traço no papel diz "está em branco na ficha", que seria falso.
 */
export function camposDoContrato(f: Freelancer): Record<string, string> {
  const t = (v: unknown) => String(v ?? "").trim();
  return {
    // O ID nunca fica em branco no papel (regra da lista de fichas): sem CPF
    // que confira, "sem ID", como o crachá da tela.
    ID: idDoContrato(f) || "sem ID",
    Nome: t(f.nome),
    Colaborador: t(f.nome),
    "E-mail": t(f.email),
    Telefone: t(f.telefone),
    Cargo: t(f.funcao),
    Status: STATUS_DO_CONTRATO,
    [COLUNA_CONTRATO]: celulaDoContrato(f),
  };
}
