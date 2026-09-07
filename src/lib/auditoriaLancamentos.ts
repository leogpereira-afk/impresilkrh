// A auditoria dos lançamentos, dentro do app.
//
// De onde veio: em 07/09/2026 o Leonardo pediu uma conferência "funcionário
// por funcionário, linha por linha, desde o início dos lançamentos". Ela rodou
// fora do app, sobre os 1.451 lançamentos gravados, e achou coisas que nenhuma
// tela mostrava. Este arquivo é essa conferência virada regra: as MESMAS
// perguntas, agora rodando na tela toda vez, para nunca mais precisar de uma
// varredura manual.
//
// O que ela pergunta de cada linha:
//   1. o tipo bate com a conta do plano que veio na descrição?
//   2. a competência bate com o vencimento (regra 16→15)?
//   3. a pessoa existe no cadastro?
//   4. o mesmo título do ERP entrou duas vezes?
//   5. o valor é um valor?
//
// E de cada PESSOA:
//   6. o cadastro contradiz os pagamentos? (pago depois de desligar, inativo
//      sem data, ativo com data de saída, pago antes de admitir, sem admissão)
//      — esta é a mais importante: data errada tira a pessoa do quadro do mês,
//      e a ficha individual dela fica vazia enquanto o dinheiro segue no total.
//   7. estava no quadro e não teve NENHUM lançamento no mês?
//   8. teve lançamento mas nenhum salário/rescisão/férias?
//
// Regras emprestadas de quem já as tem, nunca copiadas: tipoDoPlanoErp
// (lib/tipoDoPlano), tipoSocietario (lib/societario), competenciaPagto
// (lib/custos), noQuadroEm (lib/quadroNoMes).
import type { Colaborador, Pagamento } from "@/data/types";
import { competenciaPagto } from "./custos";
import { noQuadroEm } from "./quadroNoMes";
import { ehSocio, tipoSocietario } from "./societario";
import { planoDaDescricao, tipoDoPlanoErp } from "./tipoDoPlano";

export type RegraAuditoria =
  | "classificacao"
  | "conta-desconhecida"
  | "competencia"
  | "orfao"
  | "duplicado-erp"
  | "possivel-duplicata"
  | "valor"
  | "cadastro"
  | "sem-lancamento"
  | "sem-salario"
  | "casado-pelo-nome";

export type Gravidade = "erro" | "atencao" | "aviso";

export interface AchadoAuditoria {
  regra: RegraAuditoria;
  gravidade: Gravidade;
  /** Quem é o assunto: a pessoa. Vazio só quando nem isso dá para dizer. */
  colaboradorId: string;
  /** Lançamentos citados (ids). Vazio quando o achado é do cadastro ou de uma ausência. */
  pagamentoIds: string[];
  competencias: string[];
  titulo: string;
  detalhe: string;
  valor: number;
  /** Conserto seguro e determinístico, quando existe. */
  conserto?: { campo: "tipo" | "competencia"; para: string };
}

export interface ResumoAuditoria {
  linhas: number;
  pessoas: number;
  competencias: string[];
  porRegra: Record<string, number>;
  porGravidade: Record<Gravidade, number>;
  /** Achados com conserto automático disponível. */
  consertaveis: number;
}

/** Tipos que uma pessoa pode receber DEPOIS de sair — não são erro de quadro. */
/* Verbas do ACERTO de quem saiu. Recebê-las depois da data de saída é o
   esperado, não contradição — e o FGTS/INSS individualizado cai SEMPRE na
   competência seguinte (a guia vence no dia 20 e a janela é 16→15), então todo
   desligado com encargo no nome dele caía aqui como erro vermelho.
   Pior: o quadro verde logo acima, que filtra as verbas, NÃO listava essa
   pessoa — dois blocos da mesma tela davam respostas opostas sobre a mesma
   ficha. A constante existia desde o início e nunca tinha sido usada. */
const TIPOS_DE_QUEM_SAIU = new Set(["Rescisão", "Férias", "13º Salário", "FGTS", "INSS"]);
/** O que conta como "recebeu o mês": sem isso o mês da pessoa está pela metade. */
const TIPOS_DE_MES_FECHADO = new Set(["Salário", "Rescisão", "Férias"]);
const mes = (d?: string | null) => (d ?? "").slice(0, 7);
const num = (v: unknown) => Number(v) || 0;
const arred = (v: number) => Math.round(v * 100) / 100;
const soma = (ps: Pagamento[]) => arred(ps.reduce((s, p) => s + num(p.valor), 0));
const ehManualSemErp = (p: Pagamento) => !p.idMubi;

export function auditarLancamentos(
  pagamentos: Pagamento[],
  colaboradores: Colaborador[],
  opcoes: { de?: string; ate?: string } = {},
): { achados: AchadoAuditoria[]; resumo: ResumoAuditoria } {
  const porId = new Map(colaboradores.map((c) => [c.id, c]));
  const dentro = (c: string) => (!opcoes.de || c >= opcoes.de) && (!opcoes.ate || c <= opcoes.ate);
  const pags = pagamentos.filter((p) => dentro(p.competencia));
  const achados: AchadoAuditoria[] = [];
  const add = (a: AchadoAuditoria) => achados.push(a);
  const nomeDe = (id: string) => porId.get(id)?.nome ?? `(sem cadastro: ${id})`;

  // ---- linha por linha ----
  const porMubi = new Map<string, Pagamento[]>();
  const porAssinatura = new Map<string, Pagamento[]>();
  for (const p of pags) {
    const c = porId.get(p.colaboradorId) ?? null;
    const plano = planoDaDescricao(p.descricao);

    if (plano) {
      const esperado = tipoSocietario(plano, c) ?? tipoDoPlanoErp(plano, "Outros");
      if (esperado === "Outros") {
        add({ regra: "conta-desconhecida", gravidade: "atencao", colaboradorId: p.colaboradorId, pagamentoIds: [p.id], competencias: [p.competencia],
          titulo: `Conta que nenhuma regra reconhece`, detalhe: `${nomeDe(p.colaboradorId)} · ${plano} · gravado como "${p.tipo}"`, valor: num(p.valor) });
      } else if (esperado !== p.tipo) {
        add({ regra: "classificacao", gravidade: "erro", colaboradorId: p.colaboradorId, pagamentoIds: [p.id], competencias: [p.competencia],
          titulo: `Tipo não bate com a conta do ERP`, detalhe: `${nomeDe(p.colaboradorId)} · ${plano} ⇒ ${esperado}, gravado "${p.tipo}"`, valor: num(p.valor),
          conserto: { campo: "tipo", para: esperado } });
      }
    }

    const venc = String(p.dataPagamento ?? "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(venc)) {
      const esperada = competenciaPagto(venc);
      if (esperada !== p.competencia) {
        add({ regra: "competencia", gravidade: "erro", colaboradorId: p.colaboradorId, pagamentoIds: [p.id], competencias: [p.competencia],
          titulo: "Competência não bate com o vencimento", detalhe: `${nomeDe(p.colaboradorId)} · vence ${venc} ⇒ ${esperada}, gravado ${p.competencia}`, valor: num(p.valor),
          conserto: { campo: "competencia", para: esperada } });
      }
    } else if (!ehManualSemErp(p)) {
      add({ regra: "competencia", gravidade: "atencao", colaboradorId: p.colaboradorId, pagamentoIds: [p.id], competencias: [p.competencia],
        titulo: "Lançamento do ERP sem vencimento", detalhe: `${nomeDe(p.colaboradorId)} · data "${p.dataPagamento ?? ""}"`, valor: num(p.valor) });
    }

    if (!c) {
      add({ regra: "orfao", gravidade: "erro", colaboradorId: p.colaboradorId, pagamentoIds: [p.id], competencias: [p.competencia],
        titulo: "Lançamento de alguém que não está no cadastro", detalhe: `colaboradorId "${p.colaboradorId}" não existe`, valor: num(p.valor) });
    }
    // Casou por texto (nome da origem ou nome na descrição), não pelo ID:
    // é palpite, e palpite erra em silêncio. Vale só para o que já traz a marca.
    if (p.casadoPor === "nome" || p.casadoPor === "descricao") {
      add({ regra: "casado-pelo-nome", gravidade: "aviso", colaboradorId: p.colaboradorId, pagamentoIds: [p.id], competencias: [p.competencia],
        titulo: "Ligado à pessoa pelo nome, não pelo ID", detalhe: `${nomeDe(p.colaboradorId)} · ${p.tipo} · casou por ${p.casadoPor === "nome" ? "nome da origem" : "nome na descrição"}. Preencha o CPF (ou escreva "ID 000000") no título do ERP para casar pela chave.`, valor: num(p.valor) });
    }
    if (!(num(p.valor) > 0)) {
      add({ regra: "valor", gravidade: "erro", colaboradorId: p.colaboradorId, pagamentoIds: [p.id], competencias: [p.competencia],
        titulo: "Valor zerado ou negativo", detalhe: `${nomeDe(p.colaboradorId)} · ${p.tipo} · ${p.valor}`, valor: num(p.valor) });
    }

    if (p.idMubi) porMubi.set(String(p.idMubi), [...(porMubi.get(String(p.idMubi)) ?? []), p]);
    const ass = `${p.colaboradorId}|${p.competencia}|${p.tipo}|${num(p.valor).toFixed(2)}|${venc}`;
    porAssinatura.set(ass, [...(porAssinatura.get(ass) ?? []), p]);
  }

  for (const [id, ps] of porMubi) {
    if (ps.length < 2) continue;
    add({ regra: "duplicado-erp", gravidade: "erro", colaboradorId: ps[0].colaboradorId, pagamentoIds: ps.map((p) => p.id), competencias: [...new Set(ps.map((p) => p.competencia))],
      titulo: "O mesmo título do ERP entrou mais de uma vez", detalhe: `Título ${id} em ${ps.length} lançamentos — o dinheiro está contado ${ps.length}×`, valor: soma(ps.slice(1)) });
  }
  // Mesma pessoa, mês, tipo, valor E MESMO VENCIMENTO. Datas diferentes são a
  // vida normal (duas diárias de R$ 63 em dias diferentes); mesma data, não.
  for (const [, ps] of porAssinatura) {
    if (ps.length < 2) continue;
    if (new Set(ps.map((p) => p.idMubi ?? p.id)).size !== ps.length) continue;
    add({ regra: "possivel-duplicata", gravidade: "atencao", colaboradorId: ps[0].colaboradorId, pagamentoIds: ps.map((p) => p.id), competencias: [ps[0].competencia],
      titulo: "Títulos gêmeos no mesmo dia", detalhe: `${nomeDe(ps[0].colaboradorId)} · ${ps.length}× ${ps[0].tipo} de ${ps[0].valor} vencendo em ${String(ps[0].dataPagamento ?? "").slice(0, 10)} — confira se o ERP não lançou em duplicidade`, valor: soma(ps.slice(1)) });
  }

  // ---- pessoa por pessoa: o cadastro bate com o que foi pago? ----
  for (const c of colaboradores) {
    const dela = pags.filter((p) => p.colaboradorId === c.id);
    const problemas: string[] = [];
    const adm = mes(c.dataAdmissao);
    const des = mes(c.dataDesligamento);
    // "Até quando ela foi paga COMO QUEM TRABALHA". O acerto de quem saiu não
    // conta: FGTS e INSS individualizados caem SEMPRE na competência seguinte
    // (a guia vence no dia 20 e a janela é 16→15), então todo desligado com
    // encargo no nome dele virava erro vermelho aqui — enquanto o quadro verde
    // da mesma tela, que filtra as verbas, não o listava. Dois blocos, duas
    // respostas opostas sobre a mesma ficha.
    const trabalhadas = dela.filter((p) => !TIPOS_DE_QUEM_SAIU.has(p.tipo));
    const ultima = trabalhadas.length ? trabalhadas.map((p) => p.competencia).sort().slice(-1)[0] : "";
    const primeira = dela.length ? dela.map((p) => p.competencia).sort()[0] : "";
    if (trabalhadas.length && des && ultima > des) problemas.push(`pago até ${ultima}, mas o cadastro diz desligado em ${des}`);
    if (trabalhadas.length && !des && c.statusId === "inativo") problemas.push(`inativo sem data de desligamento (pago até ${ultima})`);
    if (c.statusId === "ativo" && des) problemas.push(`marcado ativo, mas com data de desligamento (${des})`);
    if (!adm && dela.length) problemas.push("sem data de admissão");
    if (dela.length && adm && primeira < adm) {
      // Só é anomalia se o PAGAMENTO aconteceu antes de admitir. Vencimento no
      // dia 5 pertence ao mês anterior pela regra 16→15: o rótulo ser anterior
      // à admissão é normal e não vira achado.
      const antes = dela.filter((p) => String(p.dataPagamento ?? "").slice(0, 10) < String(c.dataAdmissao ?? ""));
      if (antes.length) problemas.push(`${antes.length} pagamento(s) com vencimento anterior à admissão (${c.dataAdmissao})`);
    }
    if (problemas.length) {
      add({ regra: "cadastro", gravidade: "erro", colaboradorId: c.id, pagamentoIds: [], competencias: dela.map((p) => p.competencia).sort(),
        titulo: "O cadastro contradiz os pagamentos", detalhe: `${c.nome}: ${problemas.join(" · ")}. Enquanto isso não for corrigido, ela some do quadro do mês e a ficha individual dela fica vazia.`, valor: soma(dela) });
    }
  }

  // ---- mês a mês: quem estava no quadro e não recebeu ----
  const comps = [...new Set(pags.map((p) => p.competencia).filter(Boolean))].sort();
  const semNada = new Map<string, string[]>();
  const semSalario = new Map<string, string[]>();
  for (const comp of comps) {
    const doMes = pags.filter((p) => p.competencia === comp);
    const comAlgo = new Set(doMes.map((p) => p.colaboradorId));
    const comFechamento = new Set(doMes.filter((p) => TIPOS_DE_MES_FECHADO.has(p.tipo)).map((p) => p.colaboradorId));
    for (const c of colaboradores) {
      if (!noQuadroEm(c, comp)) continue;
      if (!comAlgo.has(c.id)) semNada.set(c.id, [...(semNada.get(c.id) ?? []), comp]);
      else if (!comFechamento.has(c.id)) semSalario.set(c.id, [...(semSalario.get(c.id) ?? []), comp]);
    }
  }
  for (const [id, ms] of semNada) {
    const c = porId.get(id);
    add({ regra: "sem-lancamento", gravidade: "atencao", colaboradorId: id, pagamentoIds: [], competencias: ms,
      titulo: `${ms.length} mês(es) no quadro sem nenhum lançamento`,
      detalhe: `${c?.nome ?? id} estava no quadro em ${ms.join(", ")} e não tem lançamento nenhum. Ou o vínculo do ERP não casou (procure em “Não encontrados”), ou o cadastro tem data errada.`, valor: 0 });
  }
  for (const [id, ms] of semSalario) {
    const c = porId.get(id);
    add({ regra: "sem-salario", gravidade: "aviso", colaboradorId: id, pagamentoIds: [], competencias: ms,
      titulo: `${ms.length} mês(es) sem salário, só outras verbas`,
      detalhe: `${c?.nome ?? id}: ${ms.join(", ")}. Normal em mês que ainda não fechou; suspeito num mês antigo.`, valor: 0 });
  }

  // Os que pesam mais primeiro; dentro da mesma gravidade, o de maior valor.
  const peso: Record<Gravidade, number> = { erro: 0, atencao: 1, aviso: 2 };
  achados.sort((a, b) => peso[a.gravidade] - peso[b.gravidade] || b.valor - a.valor);

  const resumo: ResumoAuditoria = {
    linhas: pags.length,
    pessoas: new Set(pags.map((p) => p.colaboradorId)).size,
    competencias: comps,
    porRegra: {},
    porGravidade: { erro: 0, atencao: 0, aviso: 0 },
    consertaveis: achados.filter((a) => a.conserto).length,
  };
  for (const a of achados) {
    resumo.porRegra[a.regra] = (resumo.porRegra[a.regra] ?? 0) + 1;
    resumo.porGravidade[a.gravidade] += 1;
  }
  return { achados, resumo };
}

export const ROTULO_REGRA: Record<RegraAuditoria, string> = {
  classificacao: "Tipo ≠ conta do ERP",
  "conta-desconhecida": "Conta não reconhecida",
  competencia: "Competência ≠ vencimento",
  orfao: "Pessoa fora do cadastro",
  "duplicado-erp": "Título do ERP em dobro",
  "possivel-duplicata": "Títulos gêmeos no mesmo dia",
  valor: "Valor inválido",
  cadastro: "Cadastro contradiz os pagamentos",
  "sem-lancamento": "Mês no quadro sem lançamento",
  "sem-salario": "Mês sem salário",
  "casado-pelo-nome": "Ligado pelo nome, não pelo ID",
};

// ---------------------------------------------------------------------------
// COMO CORRIGIR CADA ACHADO
//
// A auditoria apontava e parava aí (pedido do Léo, 07/09/2026: "mostra esses
// defeitos mas não mostra como corrigir"). Apontar sem dizer o que fazer
// transfere o trabalho inteiro para quem lê — e o RH não conhece as regras que
// geraram o achado.
//
// Cada regra diz TRÊS coisas: a causa (por que apareceu), os passos (na ordem,
// no imperativo) e onde se resolve. O primeiro passo é sempre o que resolve o
// caso mais comum; os seguintes são as exceções.
// ---------------------------------------------------------------------------

/** Onde o conserto acontece — vira o rótulo do atalho na tela. */
export type OndeCorrigir = "automatico" | "ficha" | "erp" | "quadro";

export interface ComoCorrigir {
  /** Por que este achado existe, numa frase. */
  causa: string;
  /** O que fazer, na ordem. O primeiro resolve o caso comum. */
  passos: string[];
  onde: OndeCorrigir;
}

export const COMO_CORRIGIR: Record<RegraAuditoria, ComoCorrigir> = {
  classificacao: {
    causa: "O nome da conta no ERP diz um tipo e o lançamento está gravado com outro.",
    onde: "automatico",
    passos: [
      "Use “Corrigir automático(s)” aqui em cima: a regra lê o NOME da conta e regrava o tipo.",
      "Se o tipo certo não for o que a conta diz, o erro está no Mubisys — corrija a conta lá, porque aqui quem manda é o nome dela.",
    ],
  },
  "conta-desconhecida": {
    causa: "O contador criou ou renomeou uma conta que nenhuma regra de classificação reconhece; o tipo gravado foi um palpite.",
    onde: "ficha",
    passos: [
      "Abra a pessoa e confira se o tipo gravado faz sentido para essa conta.",
      "Se a conta veio para ficar, peça para incluir o nome dela na regra — assim o mês que vem já entra classificado.",
      "Nunca classifique pelo código: o contador renumera o plano inteiro e o código muda de dono.",
    ],
  },
  competencia: {
    causa: "A competência gravada não é a que o vencimento manda (a janela vai do dia 16 ao 15 do mês seguinte).",
    onde: "automatico",
    passos: [
      "Use “Corrigir automático(s)”: recalcula a competência pela data de vencimento.",
      "Só recuse se alguém lançou à mão de propósito num mês diferente — aí o certo é o que está gravado.",
    ],
  },
  orfao: {
    causa: "O lançamento aponta para uma pessoa que não existe no cadastro.",
    onde: "erp",
    passos: [
      "Quase sempre é id variante: a pessoa EXISTE com outro id. Procure pelo nome no cadastro e reconecte antes de apagar qualquer coisa.",
      "Se ninguém corresponde, o vínculo do ERP casou errado: rode “Buscar do Mubisys” e aponte a pessoa certa na prévia.",
    ],
  },
  "duplicado-erp": {
    causa: "O mesmo título do ERP entrou mais de uma vez — o dinheiro está contado em dobro no mês.",
    onde: "ficha",
    passos: [
      "Abra a pessoa e apague as cópias, deixando um lançamento por título.",
      "Depois rode “Buscar do Mubisys” do mês: o título tem id próprio, então a reimportação passa a atualizar em vez de duplicar.",
    ],
  },
  "possivel-duplicata": {
    causa: "Dois lançamentos iguais na mesma pessoa, tipo, valor e dia. Pode ser duplicidade do ERP ou dois pagamentos de verdade.",
    onde: "ficha",
    passos: [
      "Confira no Mubisys se são dois títulos distintos ou o mesmo lançado duas vezes.",
      "Se for o mesmo, apague um na ficha da pessoa.",
      "Se forem dois pagamentos reais (duas diárias no mesmo dia, por exemplo), não mexa — o aviso continua aparecendo e está certo.",
    ],
  },
  valor: {
    causa: "Lançamento com valor zero ou negativo.",
    onde: "ficha",
    passos: [
      "Abra a pessoa e confira o valor contra o Mubisys.",
      "Zero costuma ser importação que não leu o campo; negativo costuma ser estorno lançado como pagamento.",
    ],
  },
  cadastro: {
    causa: "A data de admissão, a de desligamento ou o status brigam com os pagamentos que existem.",
    onde: "ficha",
    passos: [
      "Abra a ficha e acerte a data de desligamento (ou tire o status inativo de quem continua recebendo).",
      "Se a pessoa saiu mesmo, use “Desligar pelo último pagamento” aqui embaixo: grava a data no fim do último mês em que ela recebeu.",
      "Enquanto não corrigir, ela some do quadro do mês e a ficha dela abre vazia — o total do mês fica errado por baixo, sem avisar.",
    ],
  },
  "sem-lancamento": {
    causa: "A pessoa estava no quadro naquele mês e não tem lançamento nenhum.",
    onde: "erp",
    passos: [
      "Primeiro procure o nome dela em “Não encontrados”, na prévia da busca: o vínculo do ERP pode não ter casado por diferença de grafia ou CPF em branco.",
      "Se não estiver lá, a data de admissão ou de desligamento do cadastro está errada e põe a pessoa num mês em que ela não estava.",
      "Se o mês inteiro estiver vazio para todo mundo, use “Puxar histórico” para trazer a folha que faltou.",
    ],
  },
  "sem-salario": {
    causa: "A pessoa recebeu outras verbas no mês, mas nem salário, nem rescisão, nem férias.",
    onde: "erp",
    passos: [
      "No mês corrente isso é normal: o salário da competência vence no início do mês seguinte.",
      "Em mês antigo, falta folha: use “Puxar histórico” e confira se o título não está no ERP com outro nome ou outro CPF.",
    ],
  },
  "casado-pelo-nome": {
    causa: "O título do ERP veio sem CPF e sem ID; o sistema ligou à pessoa comparando o nome, que pode repetir ou estar escrito diferente.",
    onde: "erp",
    passos: [
      "Confira na ficha se o lançamento é mesmo desta pessoa (o ID dela aparece ao lado do nome).",
      "No ERP, preencha o CPF do favorecido ou escreva “ID 000000” na descrição do título: da próxima puxada em diante ele casa pela chave.",
    ],
  },
};

export const ROTULO_ONDE: Record<OndeCorrigir, string> = {
  automatico: "Tem conserto automático",
  ficha: "Resolve na ficha da pessoa",
  erp: "Resolve na busca do Mubisys",
  quadro: "Resolve no cadastro",
};
