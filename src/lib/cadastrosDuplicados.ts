// ============================================================================
// FICHA REPETIDA: a mesma pessoa cadastrada duas (ou três) vezes.
//
// Pedido do Léo em 07/09/2026: "jose adilando e demerval estao na empresa, eles
// devem estar com algum cadastro duplicado; ter algum local onde vê todos, onde
// pode ser possível apagar o que deseja". Ele estava certo nos dois nomes — nas
// 93 fichas do banco naquele dia havia TRÊS grupos repetidos:
//
//   José Adilando Pereira (31 lançamentos) + Jose Adilando Pereira + José Adilando
//   Demerval Vieira (17 lançamentos) + Dermeval Vieira + Dermeval Vieira (2)
//   Kelly Raissa Soares Ruas (1 lançamento) + Kelly Raissa Soares Ruas
//
// DUAS COISAS DECIDEM O DESENHO DAQUI:
//
// 1. O CPF NÃO SERVE PARA JUNTAR. As fichas do José têm 087.236.296-57,
//    76431054300 e 84995719644 — três CPFs diferentes para a mesma pessoa. Quem
//    cadastrou de novo digitou um CPF qualquer. Então a aproximação é pelo NOME,
//    e por isso a decisão é sempre humana: nome ABRE porta aqui, e nome que abre
//    porta é palpite (ver a regra do id em lib/identidade.ts). Nada nesta lib
//    apaga nada; ela só aproxima, conta e explica.
//
// 2. "MANTER OS QUE TÊM DADOS LANÇADOS" (regra dada por ele). A ficha que tem
//    pagamento é a que fica; as de zero lançamento são as candidatas a sumir.
//    Mas ANTES de apagar vem a conferência de órfãos: registro pendurado numa
//    ficha quase nunca é lixo — é dado real com o id errado. Em 29/07/2026,
//    dos 102 órfãos do RH, 16 eram gente da casa (a Candida perderia 13
//    tarefas). Por isso o caminho oferecido é TRANSFERIR o que está pendurado
//    para a ficha boa, e só então apagar a vazia.
// ============================================================================
import { idPessoa, soDigitos } from "./identidade";

export interface FichaResumo {
  id: string;
  nome: string;
  apelido?: string | null;
  cpf?: string | null;
  statusId?: string | null;
  dataAdmissao?: string | null;
  dataDesligamento?: string | null;
}

// ---------------------------------------------------------------------------
// Onde mora o que está pendurado numa pessoa
// ---------------------------------------------------------------------------
//
// As três listas juntas cobrem TODA coleção cujo registro guarda
// `colaboradorId` — e o teste desta lib confere isso lendo data/types.ts. Uma
// lista copiada à mão falha calada: a coleção esquecida simplesmente não é
// contada, e a ficha parece vazia na hora de apagar. Era o caso de `pontos` e
// `alteracoes`, que faltavam em lib/vinculos.ts.

/** O que é DA PESSOA: muda de dono junto com ela. */
export const COLECOES_DA_PESSOA = [
  "pagamentos", "lancamentos", "fechamentos", "pontos",
  "documentos", "ferias", "movimentacoes", "avaliacoes", "metas", "pdis",
  "feedbacks", "viagens", "tarefas", "aceites", "consentimentos",
  "advertencias", "ausencias", "contatos", "treinamentos", "evolucao",
  "certificacoesNr", "respostasPesquisa", "candidatos",
] as const;

/**
 * TRILHA: testemunho do que aconteceu, escrita só para frente.
 *
 * Não muda de dono (reescrever quem acessou o quê seria falsificar o registro)
 * e não impede apagar. Depois da exclusão essas linhas continuam apontando para
 * um id que não existe mais — é assim de propósito.
 */
export const COLECOES_TRILHA = ["acessos", "alteracoes"] as const;

/** A conta de login. Não se transfere: duas contas para a mesma pessoa é o problema, não a saída. */
export const COLECOES_CONTA = ["usuarios"] as const;

/**
 * Coleções cujo id do registro embute a competência E o dono
 * ("2026-05::fulano"). Mudar o dono não muda o id, então duas fichas com o
 * mesmo mês virariam dois registros do mesmo mês para a mesma pessoa — mês
 * contado em dobro. Aqui o plano de transferência confere antes e deixa o
 * conflito de fora.
 */
export const COLECOES_POR_COMPETENCIA = ["pontos", "fechamentos"] as const;

/** A folha: é o que o Léo chama de "lançamento" e o que decide qual ficha fica. */
export const COLECAO_LANCAMENTOS = "pagamentos";

// ---------------------------------------------------------------------------
// Nome: como aproximar sem inventar
// ---------------------------------------------------------------------------

// "de/da/do/das/dos/e" não distinguem ninguém e aparecem em metade dos nomes.
const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

/**
 * O nome em pedaços comparáveis: sem acento, sem caixa, sem pontuação, sem
 * número e sem partícula. É o que faz "Dermeval Vieira (2)" e "Dermeval Vieira"
 * caírem no mesmo lugar, e "José"/"Jose" pararem de ser dois nomes.
 */
export function tokensDoNome(nome: unknown): string[] {
  return String(nome ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .split(" ")
    .filter((t) => t && !PARTICULAS.has(t));
}

export const nomeNormalizado = (nome: unknown): string => tokensDoNome(nome).join(" ");

/** Os pedaços de `curto` aparecem em `longo`, na mesma ordem? */
function cabeDentro(curto: string[], longo: string[]): boolean {
  let i = 0;
  for (const t of longo) if (i < curto.length && curto[i] === t) i++;
  return i === curto.length;
}

/** Distância de edição (Levenshtein). */
function distancia(a: string, b: string): number {
  if (a === b) return 0;
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    anterior = atual;
  }
  return anterior[b.length];
}

/** 1 = igual, 0 = nada a ver. */
export function semelhanca(a: string, b: string): number {
  const maior = Math.max(a.length, b.length);
  return maior === 0 ? 1 : 1 - distancia(a, b) / maior;
}

/**
 * Duas palavras são a MESMA palavra escrita errado?
 *
 * Esta é a peça que separa o achado do falso positivo, e a semelhança sozinha
 * NÃO separa. Nas 93 fichas reais:
 *
 *   "demerval" × "dermeval"  → semelhança 0,87 — é a mesma pessoa
 *   "reinaldo" × "ronaldo"   → semelhança 0,91 — são DUAS pessoas
 *
 * O falso positivo pontua MAIS ALTO que o achado. O que de fato os separa é a
 * forma do erro: Demerval/Dermeval são as mesmas letras fora de ordem (erro de
 * digitação); Reinaldo/Ronaldo são letras diferentes (nomes diferentes).
 */
export function erroDeDigitacao(x: string, y: string): string | null {
  if (!x || !y || x === y) return null;
  // Mesmas letras, ordem trocada: "demerval"/"dermeval". Curto demais (≤3) vira
  // ruído — "ana"/"naa" não acontece, mas "ana"/"naa" passaria.
  if (x.length >= 4 && [...x].sort().join("") === [...y].sort().join("")) return "as mesmas letras em ordem trocada";
  // Mesmo tamanho, uma letra diferente: "adilson"/"adilsom".
  if (x.length === y.length) {
    let difs = 0;
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) difs++;
    if (difs === 1) return "uma letra diferente";
  }
  // Letra dobrada a mais ou a menos: "ana"/"anna", "jhonata"/"jhonnata".
  if (Math.abs(x.length - y.length) === 1) {
    const [curto, longo] = x.length < y.length ? [x, y] : [y, x];
    for (let i = 0; i < longo.length; i++) {
      if (longo.slice(0, i) + longo.slice(i + 1) !== curto) continue;
      const dobrada = (i > 0 && longo[i] === longo[i - 1]) || (i + 1 < longo.length && longo[i] === longo[i + 1]);
      if (dobrada) return "uma letra dobrada";
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// O laço entre duas fichas
// ---------------------------------------------------------------------------

export type Certeza = "alta" | "media";
export type TipoLaco =
  | "mesmo-cpf" | "mesmo-id" | "mesmo-nome" | "nome-contido" | "letras-trocadas"
  | "quase-igual" | "nome-incompleto";

export interface Laco {
  tipo: TipoLaco;
  /**
   * "alta" = tratar como a mesma pessoa e oferecer o conserto.
   * "media" = mostrar para o humano olhar; nunca sugerir nada.
   */
  certeza: Certeza;
  explicacao: string;
}

/** Abaixo disto duas palavras diferentes não merecem nem "confira". */
const LIMITE_PARECIDO = 0.7;

/**
 * O CPF serve para identificar, ou é enchimento?
 *
 * "000.000.000-00" e "111.111.111-11" são o que se digita para o campo parar de
 * reclamar. Dois cadastros preenchidos assim têm o mesmo CPF e os mesmos 6
 * primeiros dígitos — e sem esta conferência viravam "a mesma pessoa", juntando
 * gente que não tem nada a ver num grupo só. Descoberto testando: três fichas
 * de teste com CPF inventado começando igual colapsaram num grupo de seis.
 */
function cpfUtilizavel(digitos: string): boolean {
  return digitos.length === 11 && !/^(\d)\1{10}$/.test(digitos);
}

/** O que liga (ou não) duas fichas. `null` = nada em comum que valha mostrar. */
export function lacoEntre(a: FichaResumo, b: FichaResumo): Laco | null {
  if (!a || !b || a.id === b.id) return null;

  // O CPF quase nunca ajuda aqui (as três fichas do José têm três CPFs), mas
  // quando ele repete não há o que discutir.
  const cpfA = soDigitos(a.cpf), cpfB = soDigitos(b.cpf);
  const valem = cpfUtilizavel(cpfA) && cpfUtilizavel(cpfB);
  if (valem && cpfA === cpfB) return { tipo: "mesmo-cpf", certeza: "alta", explicacao: "o CPF é o mesmo" };
  const idA = idPessoa(a.cpf), idB = idPessoa(b.cpf);
  if (valem && idA && idA === idB) return { tipo: "mesmo-id", certeza: "alta", explicacao: `o ID da pessoa (${idA}) é o mesmo` };

  const ta = tokensDoNome(a.nome), tb = tokensDoNome(b.nome);
  if (!ta.length || !tb.length) return null;

  if (ta.join(" ") === tb.join(" ")) return { tipo: "mesmo-nome", certeza: "alta", explicacao: "o nome é exatamente o mesmo" };

  const [curto, longo] = ta.length <= tb.length ? [ta, tb] : [tb, ta];

  // "José Adilando" dentro de "José Adilando Pereira". Duas palavras é o
  // mínimo: com uma só, todo "Thiago" viraria parente de todo "Thiago Alves".
  if (curto.length >= 2 && curto.length < longo.length && cabeDentro(curto, longo)) {
    return { tipo: "nome-contido", certeza: "alta", explicacao: `“${curto.join(" ")}” cabe dentro de “${longo.join(" ")}”` };
  }

  if (ta.length === tb.length) {
    const difs = ta.map((t, i) => [t, tb[i]] as const).filter(([x, y]) => x !== y);
    if (difs.length === 1) {
      const [x, y] = difs[0];
      const erro = erroDeDigitacao(x, y);
      if (erro) return { tipo: "letras-trocadas", certeza: "alta", explicacao: `“${x}” e “${y}”: ${erro}` };
      if (semelhanca(x, y) >= LIMITE_PARECIDO) {
        return { tipo: "quase-igual", certeza: "media", explicacao: `só “${x}” e “${y}” diferem — pode ser gente diferente` };
      }
    }
  }

  // Ficha com o nome pela metade ("Guilherme", "Thiago"): pode ser cadastro
  // começado e abandonado de alguém que já existe inteiro. Só "confira".
  if (curto.length === 1 && longo.length >= 2 && curto[0] === longo[0]) {
    return { tipo: "nome-incompleto", certeza: "media", explicacao: `“${curto[0]}” tem uma palavra só e é o primeiro nome de “${longo.join(" ")}”` };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Agrupar
// ---------------------------------------------------------------------------

export interface GrupoRepetido {
  /** Id estável do grupo (o menor id do grupo) — serve de chave na tela. */
  chave: string;
  fichas: FichaResumo[];
  motivos: string[];
}

export interface ParAConferir {
  chave: string;
  a: FichaResumo;
  b: FichaResumo;
  motivo: string;
}

export interface Aproximacao {
  /** Fichas que são a mesma pessoa — aqui o conserto é oferecido. */
  grupos: GrupoRepetido[];
  /**
   * Pares só parecidos. Ficam SEPARADOS e em pares (não em grupo) de propósito:
   * juntar "Thiago" com três Thiagos diferentes num grupo só afirmaria que os
   * três são a mesma pessoa — que é justamente o que ninguém sabe.
   */
  conferir: ParAConferir[];
}

/** Aproxima as fichas duas a duas. Não decide nada: só junta e explica. */
export function aproximarCadastros(fichas: FichaResumo[]): Aproximacao {
  const pai = new Map<string, string>();
  const raiz = (x: string): string => {
    let r = x;
    while (pai.get(r) && pai.get(r) !== r) r = pai.get(r)!;
    return r;
  };
  for (const f of fichas) pai.set(f.id, f.id);

  const motivos = new Map<string, string[]>(); // raiz → explicações
  const conferir: ParAConferir[] = [];

  for (let i = 0; i < fichas.length; i++) {
    for (let j = i + 1; j < fichas.length; j++) {
      const laco = lacoEntre(fichas[i], fichas[j]);
      if (!laco) continue;
      if (laco.certeza === "media") {
        conferir.push({ chave: `${fichas[i].id}::${fichas[j].id}`, a: fichas[i], b: fichas[j], motivo: laco.explicacao });
        continue;
      }
      const ra = raiz(fichas[i].id), rb = raiz(fichas[j].id);
      const nova = ra < rb ? ra : rb;
      const antiga = ra < rb ? rb : ra;
      if (ra !== rb) {
        pai.set(antiga, nova);
        motivos.set(nova, [...(motivos.get(nova) ?? []), ...(motivos.get(antiga) ?? [])]);
        motivos.delete(antiga);
      }
      const texto = `${fichas[i].nome} × ${fichas[j].nome}: ${laco.explicacao}`;
      const atuais = motivos.get(nova) ?? [];
      if (!atuais.includes(texto)) motivos.set(nova, [...atuais, texto]);
    }
  }

  const porRaiz = new Map<string, FichaResumo[]>();
  for (const f of fichas) {
    const r = raiz(f.id);
    porRaiz.set(r, [...(porRaiz.get(r) ?? []), f]);
  }

  const grupos: GrupoRepetido[] = [];
  for (const [chave, lista] of porRaiz) {
    if (lista.length < 2) continue;
    grupos.push({ chave, fichas: [...lista].sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")), motivos: motivos.get(chave) ?? [] });
  }
  grupos.sort((a, b) => a.fichas[0].nome.localeCompare(b.fichas[0].nome, "pt-BR"));

  // Um par "parecido" que já caiu no mesmo grupo certo não é mais dúvida.
  const mesmoGrupo = (x: string, y: string) => raiz(x) === raiz(y) && (porRaiz.get(raiz(x))?.length ?? 0) > 1;
  return { grupos, conferir: conferir.filter((p) => !mesmoGrupo(p.a.id, p.b.id)) };
}

// ---------------------------------------------------------------------------
// Quem fica
// ---------------------------------------------------------------------------

export interface ContagemFicha {
  /** Pagamentos da folha — o que o Léo chama de lançamento. */
  lancamentos: number;
  /** Os demais registros da pessoa (documentos, férias, avaliações…). */
  dados: number;
  /** Trilha (acessos, alterações): não transfere e não impede apagar. */
  trilha: number;
  /** Contas de login apontando para esta ficha. */
  contas: number;
  /** Pessoas que têm esta ficha como gestor. */
  subordinados: number;
  /** Pessoas que têm esta ficha como padrinho na integração. */
  afilhados: number;
}

export const CONTAGEM_VAZIA: ContagemFicha = { lancamentos: 0, dados: 0, trilha: 0, contas: 0, subordinados: 0, afilhados: 0 };

export interface Escolha {
  id: string;
  motivo: string;
  /** Mais de uma ficha tem lançamento: apagar qualquer uma perde dinheiro. */
  disputa: boolean;
  /** A escolha vem do dado, ou é só desempate? */
  provada: boolean;
}

const noQuadro = (f: FichaResumo) => f.statusId !== "inativo" && !f.dataDesligamento;

/**
 * Qual ficha fica, pela regra do Léo: "manter os que têm dados lançados".
 *
 * Devolve sempre uma sugestão — nunca uma ordem. Quando nada no dado
 * distingue as fichas, `provada` vem `false` e a tela diz que a escolha é de
 * quem está olhando.
 */
export function quemFica(fichas: FichaResumo[], contar: (id: string) => ContagemFicha): Escolha | null {
  if (!fichas.length) return null;
  const c = new Map(fichas.map((f) => [f.id, contar(f.id)]));
  const ordenadas = [...fichas].sort((a, b) => {
    const ca = c.get(a.id)!, cb = c.get(b.id)!;
    return (
      cb.lancamentos - ca.lancamentos ||
      cb.dados - ca.dados ||
      Number(noQuadro(b)) - Number(noQuadro(a)) ||
      String(a.dataAdmissao ?? "9999").localeCompare(String(b.dataAdmissao ?? "9999")) ||
      a.id.localeCompare(b.id)
    );
  });
  const vencedora = ordenadas[0];
  const cv = c.get(vencedora.id)!;
  const comLancamento = fichas.filter((f) => c.get(f.id)!.lancamentos > 0);

  if (cv.lancamentos > 0) {
    return {
      id: vencedora.id,
      disputa: comLancamento.length > 1,
      provada: true,
      motivo: comLancamento.length > 1
        ? `${comLancamento.length} fichas têm lançamento — esta tem mais (${cv.lancamentos}). Transfira antes de apagar qualquer uma.`
        : `tem ${cv.lancamentos} lançamento(s) da folha; as outras não têm nenhum`,
    };
  }
  if (cv.dados > 0) {
    return { id: vencedora.id, disputa: false, provada: true, motivo: `nenhuma tem lançamento; esta é a única com registro (${cv.dados})` };
  }
  return { id: vencedora.id, disputa: false, provada: false, motivo: "nenhuma tem lançamento nem registro — a escolha é sua, pelo cadastro" };
}

// ---------------------------------------------------------------------------
// Apagar: o que se perde e o quanto tem de custar
// ---------------------------------------------------------------------------

/**
 * O quanto o clique tem de custar. Pedido do Léo: apagar ficha com lançamento
 * tem de ser bem mais difícil que apagar ficha vazia.
 */
export type Exigencia = "clique" | "conferir" | "digitar-id";
export type Recomendacao = "apagar" | "transferir" | "parar";

export interface AvaliacaoExclusao {
  exigencia: Exigencia;
  recomendacao: Recomendacao;
  /** Impedimentos que precisam ser resolvidos em outra tela antes. */
  bloqueios: string[];
  /** O que some junto com a ficha. */
  perde: string[];
  /** O que continua no sistema apontando para um id que não existe mais. */
  fica: string[];
}

/**
 * O que acontece se esta ficha for apagada.
 *
 * `temParaOndeTransferir` = existe outra ficha do mesmo grupo para receber o
 * que está pendurado aqui. Sem destino, a recomendação de quem tem dado é
 * PARAR — não faz sentido mandar transferir para lugar nenhum.
 */
export function avaliarExclusao(c: ContagemFicha, temParaOndeTransferir: boolean): AvaliacaoExclusao {
  const bloqueios: string[] = [];
  if (c.contas > 0) bloqueios.push(`${c.contas} conta(s) de acesso ao sistema apontam para esta ficha — desative em Painel de Controle → Usuários e Permissões antes.`);
  if (c.subordinados > 0) bloqueios.push(`${c.subordinados} pessoa(s) têm esta ficha como gestor — troque o gestor delas no organograma antes.`);
  if (c.afilhados > 0) bloqueios.push(`${c.afilhados} pessoa(s) têm esta ficha como padrinho na integração — troque antes.`);

  const perde: string[] = [];
  if (c.lancamentos > 0) perde.push(`${c.lancamentos} lançamento(s) da folha`);
  if (c.dados > 0) perde.push(`${c.dados} outro(s) registro(s) da pessoa`);

  const fica: string[] = [];
  if (c.trilha > 0) fica.push(`${c.trilha} linha(s) de trilha (acessos e alterações) continuam apontando para o id apagado — trilha não se reescreve.`);

  const exigencia: Exigencia = c.lancamentos > 0 ? "digitar-id" : c.dados > 0 ? "conferir" : "clique";
  const recomendacao: Recomendacao = bloqueios.length
    ? "parar"
    : c.lancamentos + c.dados > 0
      ? (temParaOndeTransferir ? "transferir" : "parar")
      : "apagar";

  return { exigencia, recomendacao, bloqueios, perde, fica };
}

// ---------------------------------------------------------------------------
// Transferir antes de apagar
// ---------------------------------------------------------------------------

export interface RegistroPendurado {
  id: string;
  colaboradorId?: string | null;
  /** Só para as coleções cujo id embute o mês. */
  competencia?: string | null;
}

export interface MudancaDeDono {
  colecao: string;
  ids: string[];
}

export interface Conflito {
  colecao: string;
  id: string;
  motivo: string;
}

export interface PlanoTransferencia {
  /** O que muda de dono, coleção por coleção. */
  mover: MudancaDeDono[];
  /** O que NÃO dá para mover sem criar registro em dobro. */
  conflitos: Conflito[];
  /** O que fica onde está por natureza (trilha, conta de login). */
  ficam: { colecao: string; quantidade: number }[];
  total: number;
}

/**
 * O que muda de dono ao passar tudo de `deId` para `paraId`.
 *
 * `registros` é o retrato do momento: coleção → registros dela. A função é pura
 * de propósito — quem grava é a tela, depois de o humano confirmar.
 *
 * O id do registro NÃO muda: mudar id é apagar e recriar, e apagar deixa lápide
 * (o mesmo id nunca mais volta). Quem manda no dono é o campo `colaboradorId`.
 * Só que em `pontos` e `fechamentos` o id embute mês e dono ("2026-05::fulano"):
 * se o destino já tem aquele mês, mover criaria dois registros do mesmo mês para
 * a mesma pessoa. Esses ficam de fora, listados como conflito.
 */
export function planoDeTransferencia(
  deId: string,
  paraId: string,
  registros: Record<string, RegistroPendurado[]>,
): PlanoTransferencia {
  const mover: MudancaDeDono[] = [];
  const conflitos: Conflito[] = [];
  const ficam: { colecao: string; quantidade: number }[] = [];

  if (!deId || !paraId || deId === paraId) return { mover: [], conflitos: [], ficam: [], total: 0 };

  for (const colecao of COLECOES_DA_PESSOA) {
    const todos = registros[colecao] ?? [];
    const daOrigem = todos.filter((r) => r.colaboradorId === deId);
    if (!daOrigem.length) continue;
    if ((COLECOES_POR_COMPETENCIA as readonly string[]).includes(colecao)) {
      const mesesDoDestino = new Set(todos.filter((r) => r.colaboradorId === paraId).map((r) => String(r.competencia ?? "")));
      const livres: string[] = [];
      for (const r of daOrigem) {
        const mes = String(r.competencia ?? "");
        if (mes && mesesDoDestino.has(mes)) {
          conflitos.push({ colecao, id: r.id, motivo: `a ficha que fica já tem ${colecao === "pontos" ? "ponto" : "fechamento"} de ${mes} — mover criaria o mês em dobro` });
        } else {
          livres.push(r.id);
          if (mes) mesesDoDestino.add(mes);
        }
      }
      if (livres.length) mover.push({ colecao, ids: livres });
    } else {
      mover.push({ colecao, ids: daOrigem.map((r) => r.id) });
    }
  }

  for (const colecao of [...COLECOES_TRILHA, ...COLECOES_CONTA]) {
    const n = (registros[colecao] ?? []).filter((r) => r.colaboradorId === deId).length;
    if (n > 0) ficam.push({ colecao, quantidade: n });
  }

  return { mover, conflitos, ficam, total: mover.reduce((s, m) => s + m.ids.length, 0) };
}
