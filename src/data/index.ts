// Registro central dos dados embutidos (defaults). A camada src/lib/store.ts
// carrega estes valores na 1ª vez e depois persiste as edições no localStorage.

import type {
  Area, Nivel, Cargo, StatusColaborador, Colaborador, Documento, DocumentoInstitucional,
  GuiaComunicacao, POP, Ferias, Movimentacao, CicloAvaliacao, Avaliacao, Meta, PDI,
  Feedback, Viagem, Tarefa, ModeloChecklist, ConsentimentoLGPD, AccessLog, Alteracao, Aceite, Config,
  Advertencia, Ausencia, Contato, TemplateMensagem, Agendamento, ArquivoRepositorio,
  Treinamento, EtapaEvolucao, Usuario, Pagamento, ContaPlano, ClassificacaoConta, EventoCalendario,
  CertificacaoNR, Pesquisa, RespostaPesquisa, Vaga, Candidato, Ponto, Lancamento, FechamentoFolha,
} from "./types";

import { AREAS } from "./areas";
import { NIVEIS } from "./niveis";
import { CARGOS } from "./cargos";
import { STATUS } from "./status";
import { COLABORADORES } from "./colaboradores";
import { INSTITUCIONAIS } from "./institucionais";
import { POPS } from "./pops";
import { MODELOS_CHECKLIST } from "./integracao";
import { TEMPLATES } from "./mensagens";
import { REPOSITORIO } from "./repositorio";
import { USUARIOS } from "./usuarios";
import { CLASSIFICACAO_CONTAS } from "./classificacaoContas";
import { EVENTOS_CALENDARIO } from "./eventos";
import { PESQUISAS } from "./pesquisas";

export const VERSAO_DADOS = "1.0.0";

export const CONFIG_DEFAULT: Config = {
  empresaNome: "Impresilk Comunicação Visual",
  empresaCidade: "Montes Claros/MG",
  corPrimaria: "#16334f",
  corAcento: "#c2a14d",
};

// Mapa: nome da coleção → tipo do elemento. Garante tipagem do useColecao.
export interface ColecaoMap {
  areas: Area;
  niveis: Nivel;
  cargos: Cargo;
  status: StatusColaborador;
  colaboradores: Colaborador;
  documentos: Documento;
  institucionais: DocumentoInstitucional;
  comunicacao: GuiaComunicacao;
  pops: POP;
  ferias: Ferias;
  movimentacoes: Movimentacao;
  ciclos: CicloAvaliacao;
  avaliacoes: Avaliacao;
  metas: Meta;
  pdis: PDI;
  feedbacks: Feedback;
  viagens: Viagem;
  tarefas: Tarefa;
  modelosChecklist: ModeloChecklist;
  consentimentos: ConsentimentoLGPD;
  acessos: AccessLog;
  alteracoes: Alteracao;
  aceites: Aceite;
  advertencias: Advertencia;
  ausencias: Ausencia;
  contatos: Contato;
  templatesMensagem: TemplateMensagem;
  agendamentos: Agendamento;
  repositorio: ArquivoRepositorio;
  treinamentos: Treinamento;
  evolucao: EtapaEvolucao;
  usuarios: Usuario;
  pagamentos: Pagamento;
  planoContas: ContaPlano;
  classificacaoCustos: ClassificacaoConta;
  eventos: EventoCalendario;
  certificacoesNr: CertificacaoNR;
  pesquisas: Pesquisa;
  respostasPesquisa: RespostaPesquisa;
  vagas: Vaga;
  candidatos: Candidato;
  pontos: Ponto;
  lancamentos: Lancamento;
  fechamentos: FechamentoFolha;
}

export type NomeColecao = keyof ColecaoMap;

// Defaults por coleção. A função garante uma cópia profunda a cada chamada
// (para que o "restaurar padrão" não compartilhe referências mutáveis).
//
// ATENÇÃO — POR QUE OS DADOS DE MOVIMENTO VÊM VAZIOS AQUI:
// Estes defaults são carregados ANTES do primeiro pull da nuvem. Como o merge
// do sync preserva o que existe só no local (para nunca apagar às cegas), tudo
// que estiver aqui é tratado como "registro novo do usuário" e SOBE para a
// nuvem no primeiro push — mesmo sendo dado de demonstração.
//
// Foi exatamente isso que aconteceu em 30/07/2026: os 514 pagamentos de exemplo
// foram parar no banco de produção e dobraram o custo de pessoal de todos os
// meses (R$ 366.538 de lixo em R$ 805.261). Só ficam aqui as coleções de
// REFERÊNCIA (áreas, níveis, cargos, status, modelos…), que o app precisa para
// abrir e que o usuário edita de propósito. Movimento — pagamento, avaliação,
// falta, ponto, vaga — nasce vazio e vem da nuvem.
export function defaultsColecoes(): { [K in NomeColecao]: ColecaoMap[K][] } {
  return structuredClone({
    areas: AREAS,
    niveis: NIVEIS,
    cargos: CARGOS,
    status: STATUS,
    colaboradores: COLABORADORES,
    documentos: [],
    institucionais: INSTITUCIONAIS,
    comunicacao: [],
    pops: POPS,
    ferias: [],
    movimentacoes: [],
    ciclos: [],
    avaliacoes: [],
    metas: [],
    pdis: [],
    feedbacks: [],
    viagens: [],
    tarefas: [],
    modelosChecklist: MODELOS_CHECKLIST,
    consentimentos: [],
    acessos: [],
    alteracoes: [],
    aceites: [],
    advertencias: [],
    ausencias: [],
    contatos: [],
    templatesMensagem: TEMPLATES,
    agendamentos: [],
    repositorio: REPOSITORIO,
    treinamentos: [],
    evolucao: [],
    usuarios: USUARIOS,
    pagamentos: [],
    planoContas: [],
    classificacaoCustos: CLASSIFICACAO_CONTAS,
    eventos: EVENTOS_CALENDARIO,
    certificacoesNr: [],
    pesquisas: PESQUISAS,
    respostasPesquisa: [],
    vagas: [],
    candidatos: [],
    pontos: [],
    lancamentos: [],
    fechamentos: [],
  });
}

export const NOMES_COLECOES = Object.keys(defaultsColecoes()) as NomeColecao[];

export * from "./types";
