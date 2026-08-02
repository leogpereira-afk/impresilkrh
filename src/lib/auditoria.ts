// ============================================================================
// Histórico de alterações — quem mexeu, no quê, quando e o que mudou.
//
// Onde fica pendurado: no ÚNICO ponto por onde toda escrita passa (store.ts).
// Espalhar chamadas de log pelas telas garante que a próxima tela nasça sem
// log — e um histórico com buraco é pior que não ter histórico, porque dá a
// impressão de que nada aconteceu naquele intervalo.
//
// O store não importa este arquivo (seria ciclo): ele expõe `definirAuditor` e
// quem manda o auditor é o main.tsx, uma vez, na subida do app.
//
// Três cuidados que o desenho embute:
//  1. RECURSÃO — gravar no log é uma escrita, que geraria outro log, sem fim.
//     A própria coleção `alteracoes` é ignorada de saída (ver NAO_AUDITAR).
//  2. VOLUME — aplicar a folha do ERP são centenas de escritas em sequência.
//     Sem `emLote`, uma importação enterraria o dia inteiro de trabalho humano
//     embaixo de 600 linhas iguais. Em lote, vira UMA linha com os números.
//  3. SEGREDO — o histórico SINCRONIZA. Guardar aqui o valor de salário ou CPF
//     entregaria, por uma coleção lateral, exatamente o que o servidor protege
//     em `colaboradores`. Campo sensível entra como "•••" (ver MASCARADOS).
// ============================================================================
import { obterDinamico } from "./store";
import { obterSessao } from "./session";

/** Uma mudança de campo, já pronta para ler na tela. */
export interface MudancaCampo {
  campo: string;
  de: string;
  para: string;
}

export interface EventoAuditoria {
  colecao: string;
  acao: "criou" | "alterou" | "removeu";
  id: string;
  antes?: Record<string, unknown> | null;
  depois?: Record<string, unknown> | null;
}

/** O que o auditor entrega para ser gravado. */
export interface LinhaHistorico {
  acao: string;
  recurso: string;
  colaboradorId: string | null;
  detalhe?: string;
  colecao?: string;
  registroId?: string;
  mudancas?: MudancaCampo[];
  /** Total de campos alterados (pode ser maior que `mudancas.length`). */
  totalCampos?: number;
  qtd?: number;
}

// Coleções cujo nome não diz nada para quem lê o histórico.
const ROTULO: Record<string, string> = {
  colaboradores: "Colaborador",
  pagamentos: "Pagamento",
  documentos: "Documento",
  ferias: "Férias",
  advertencias: "Advertência",
  ausencias: "Ausência",
  avaliacoes: "Avaliação",
  metas: "Meta",
  pdis: "PDI",
  feedbacks: "Feedback",
  movimentacoes: "Movimentação",
  usuarios: "Usuário",
  cargos: "Cargo",
  areas: "Área",
  niveis: "Nível",
  status: "Status",
  ciclos: "Ciclo de avaliação",
  treinamentos: "Treinamento",
  viagens: "Viagem",
  planoContas: "Plano de contas",
  classificacaoCustos: "Classificação de conta",
  pontos: "Ponto",
  lancamentos: "Folha variável",
  fechamentos: "Fechamento",
  vagas: "Vaga",
  candidatos: "Candidato",
  contatos: "Contato",
  repositorio: "Arquivo",
  consentimentos: "Consentimento LGPD",
};

export const rotuloColecao = (c: string) => ROTULO[c] ?? c;

// Campos que não são mudança de verdade (carimbo) ou que não podem ser escritos
// em lugar nenhum (segredo).
const IGNORADOS = new Set(["id", "atualizadoEm", "criadoEm", "importadoEm", "buscadoEm", "sincronizadoEm"]);

/**
 * Campos cujo VALOR nunca entra no histórico — só o fato de terem mudado.
 *
 * A revisão de 02/08/2026 mostrou por que isto é obrigatório: o histórico
 * sincroniza, e guardar "Salário: 3200 → 3800" aqui entregaria a folha inteira
 * a quem o servidor protege justamente disso na coleção `colaboradores`. O
 * histórico responde QUEM mexeu no QUÊ; QUANTO se vê na ficha, que tem
 * controle de acesso. A lista espelha CAMPOS_SENSIVEIS da Edge Function.
 */
const MASCARADOS = new Set([
  // segredo puro
  "senhaHash", "senha", "token", "sessionSecret", "hash",
  // dado pessoal protegido no servidor (CAMPOS_SENSIVEIS do sync)
  "cpf", "salario", "adicionais", "refMin", "refMax", "telefone", "matriculaEsocial",
  "enderecoRua", "enderecoNumero", "enderecoComplemento", "enderecoBairro", "enderecoCep",
  "conjugeNome", "conjugeTelefone", "filhos", "contatoEmergencia", "dataNascimento",
  // dinheiro da folha
  "valor", "salarioAnterior", "salarioNovo",
  // anexos
  "fotoDataUrl", "arquivoDataUrl",
]);

/** Coleções que NÃO se audita. */
const NAO_AUDITAR = new Set([
  "alteracoes", // o próprio histórico: auditá-lo é recursão infinita
  "acessos", // trilha LGPD, tem vida própria
  // Pesquisa anônima: registrar quem respondeu desfaz o anonimato prometido.
  "respostasPesquisa",
]);

/** `undefined`, `null`, "" e lista vazia são a MESMA coisa para quem lê. */
const vazio = (v: unknown) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

// Nomes de campo em português, para o histórico não falar em código.
const CAMPO: Record<string, string> = {
  nome: "Nome", salario: "Salário", cargoId: "Cargo", areaId: "Área", nivelId: "Nível",
  statusId: "Status", email: "E-mail", telefone: "Telefone", cpf: "CPF",
  dataAdmissao: "Admissão", dataDesligamento: "Desligamento", gestorId: "Gestor",
  valor: "Valor", tipo: "Tipo", competencia: "Competência", descricao: "Descrição",
  dataPagamento: "Data de pagamento", perfil: "Perfil", modulos: "Módulos",
  ativo: "Ativo", observacao: "Observação", motivo: "Motivo", classe: "Classificação",
  idMubi: "Título no ERP", manual: "Lançado à mão", naoBatePonto: "Não bate ponto",
};
export const rotuloCampo = (c: string) => CAMPO[c] ?? c;

/**
 * Valor pronto para ler. Objeto e lista viram "(alterado)" de propósito: o
 * histórico precisa caber na memória do navegador por meses, e despejar o
 * objeto inteiro a cada edição estoura o armazenamento sem dizer mais nada.
 */
export function valorLegivel(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.length > 60 ? v.slice(0, 60) + "…" : v;
  // Lista curta de texto (módulos, permissões) mostra o CONTEÚDO: saber que
  // "os módulos mudaram de 3 para 4" não diz qual acesso a pessoa ganhou.
  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    if (v.length <= 8 && v.every((x) => typeof x === "string")) return [...v].sort().join(", ");
    return `(lista com ${v.length})`;
  }
  return "(alterado)";
}

const mesmo = (a: unknown, b: unknown) => {
  if (a === b) return true;
  // Salvar o formulário sem mexer em nada não pode inventar mudança: o campo
  // que nasce como `undefined` e volta como `[]` continua vazio.
  if (vazio(a) && vazio(b)) return true;
  if (typeof a === "object" || typeof b === "object") {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
  }
  return false;
};

/** O que mudou entre dois registros — só os campos que interessam ao humano. */
// Campos que o humano quer ver primeiro quando a lista é cortada. Cortar em
// ordem alfabética escondia justamente a mudança de cargo e de perfil.
const PRIORIDADE = ["salario", "cargoId", "nivelId", "perfil", "permissoes", "modulos", "statusId", "gestorId", "valor", "tipo", "competencia"];

export function diferencas(
  antes: Record<string, unknown> | null | undefined,
  depois: Record<string, unknown> | null | undefined,
  limite = 12,
): { mudancas: MudancaCampo[]; total: number } {
  const a = antes ?? {};
  const b = depois ?? {};
  const campos = [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((c) => !IGNORADOS.has(c))
    .filter((c) => !mesmo(a[c], b[c]))
    .sort((x, y) => {
      const px = PRIORIDADE.indexOf(x), py = PRIORIDADE.indexOf(y);
      if (px !== py) return (px < 0 ? 99 : px) - (py < 0 ? 99 : py);
      return x.localeCompare(y);
    });
  const mudancas = campos.slice(0, limite).map((campo) =>
    MASCARADOS.has(campo)
      // Mudou, e isso é o que o histórico registra. O valor fica na ficha.
      ? { campo: rotuloCampo(campo), de: "•••", para: "•••" }
      : { campo: rotuloCampo(campo), de: valorLegivel(a[campo]), para: valorLegivel(b[campo]) },
  );
  // O total real vai junto: dizer "12 campos" quando mudaram 40 é mentir com
  // número, que é a pior forma de mentir num log.
  return { mudancas, total: campos.length };
}

/** Como o registro se chama para um humano (título da linha do histórico). */
export function nomeDoRegistro(r: Record<string, unknown> | null | undefined, id: string): string {
  if (!r) return id;
  for (const k of ["nome", "titulo", "descricao", "codigo"]) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.length > 50 ? v.slice(0, 50) + "…" : v;
  }
  return id;
}

// ---------------------------------------------------------------------------
// Lote: várias escritas que são UMA ação para quem lê
// ---------------------------------------------------------------------------
interface Lote {
  rotulo: string;
  criados: number;
  alterados: number;
  removidos: number;
  colecoes: Set<string>;
}
let loteAtivo: Lote | null = null;
let profundidade = 0;

/**
 * Agrupa tudo que for escrito dentro de `fn` numa linha só do histórico.
 *
 * Reentrante: um lote dentro de outro não abre um segundo — o de fora manda,
 * porque é ele que tem o nome que o humano reconhece.
 */
export function emLote<T>(rotulo: string, fn: () => T): T {
  if (profundidade === 0) {
    loteAtivo = { rotulo, criados: 0, alterados: 0, removidos: 0, colecoes: new Set() };
  }
  profundidade++;
  try {
    return fn();
  } finally {
    profundidade--;
    if (profundidade === 0) {
      const l = loteAtivo;
      loteAtivo = null;
      // Lote que não escreveu nada não vira linha: "aplicou e nada mudou" já
      // aparece no aviso da tela, e no histórico seria só ruído.
      if (l && l.criados + l.alterados + l.removidos > 0) {
        const partes: string[] = [];
        if (l.criados) partes.push(`${l.criados} novo(s)`);
        if (l.alterados) partes.push(`${l.alterados} alterado(s)`);
        if (l.removidos) partes.push(`${l.removidos} removido(s)`);
        gravar({
          acao: "LOTE",
          recurso: l.rotulo,
          colaboradorId: null,
          detalhe: partes.join(" · "),
          colecao: [...l.colecoes].join(", "),
          qtd: l.criados + l.alterados + l.removidos,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------
type Escritor = (linha: LinhaHistorico & { usuarioColaboradorId: string; usuarioNome: string; perfil: string; criadoEm: string }) => void;
let escritor: Escritor | null = null;

/** Quem de fato guarda a linha (o store injeta, para não haver ciclo). */
export function definirEscritorDeHistorico(fn: Escritor | null): void {
  escritor = fn;
}

function gravar(linha: LinhaHistorico): void {
  if (!escritor) return;
  const s = obterSessao();
  // Sem sessão não há "quem" — e um histórico sem autor não serve para nada.
  // Acontece no boot (migrações) e é justamente o que NÃO queremos registrar.
  if (!s) return;
  const eu = (obterDinamico("colaboradores") as { id: string; nome?: string }[]).find((c) => c.id === s.colaboradorId);
  escritor({
    ...linha,
    usuarioColaboradorId: s.colaboradorId,
    usuarioNome: eu?.nome ?? s.colaboradorId ?? "Usuário",
    perfil: String(s.perfil ?? ""),
    criadoEm: new Date().toISOString(),
  });
}

/**
 * Registra uma ação que NÃO passa pelo caminho normal de escrita.
 *
 * `definirColecao` troca a coleção inteira de uma vez e não avisa o auditor —
 * de propósito, porque é assim que a sincronização aplica o que vem do
 * servidor, e download não é "alguém mexeu". O preço é que as poucas ações
 * humanas que também usam esse caminho (enviar o plano de contas, preencher
 * CPF em massa) ficariam invisíveis. Estas chamam aqui, na mão.
 */
export function registrarAcaoManual(rotulo: string, detalhe?: string, colecao?: string): void {
  gravar({ acao: "LOTE", recurso: rotulo, colaboradorId: null, detalhe, colecao });
}

/** Recebe cada escrita do store e decide se vira linha do histórico. */
export function auditar(ev: EventoAuditoria): void {
  // 1) Coleções que não se audita (o próprio histórico = recursão infinita).
  if (NAO_AUDITAR.has(ev.colecao)) return;

  // 2) Em lote, só conta — a linha sai no fim, uma só.
  if (loteAtivo) {
    loteAtivo.colecoes.add(ev.colecao); // chave CRUA: o rótulo é aplicado só na exibição
    if (ev.acao === "criou") loteAtivo.criados++;
    else if (ev.acao === "alterou") loteAtivo.alterados++;
    else loteAtivo.removidos++;
    return;
  }

  const registro = ev.acao === "removeu" ? ev.antes : ev.depois;
  const dif = ev.acao === "alterou" ? diferencas(ev.antes, ev.depois) : { mudancas: [], total: 0 };
  // Alteração que não mudou campo nenhum (regravar o mesmo valor) não é
  // notícia: entrava como linha vazia e enchia o histórico de nada.
  if (ev.acao === "alterou" && dif.total === 0) return;

  gravar({
    acao: ev.acao.toUpperCase(),
    recurso: `${rotuloColecao(ev.colecao)}: ${nomeDoRegistro(registro as Record<string, unknown>, ev.id)}`,
    // Quando o registro é sobre uma pessoa, guarda o vínculo para dar para
    // filtrar "tudo que mexeram no Fulano".
    colaboradorId:
      ev.colecao === "colaboradores"
        ? ev.id
        : ((registro as Record<string, unknown>)?.colaboradorId as string) ?? null,
    colecao: ev.colecao,
    registroId: ev.id,
    mudancas: dif.mudancas.length ? dif.mudancas : undefined,
    totalCampos: dif.total || undefined,
  });
}
