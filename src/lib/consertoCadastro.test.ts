/* Consertar o cadastro pelo que os pagamentos provam.
 *
 * Os casos vêm dos 8 achados reais lidos do banco em 07/09/2026 — não são
 * inventados. A regra que decide é o TIPO da verba recebida depois da data:
 * salário prova que a pessoa trabalhou; rescisão e férias são o acerto de quem
 * saiu e não provam nada.
 *
 * Começa pelo caso ruim: reativar alguém que de fato saiu seria pior que o
 * problema original — ela voltaria a contar no quadro e no custo do mês.
 */
import { describe, it, expect } from "vitest";
import { reativarQuemContinuaRecebendo, admissaoAnteriorAoPrimeiroPagamento, opcoesDeStatus } from "./consertoCadastro";
import type { Colaborador, Pagamento } from "@/data/types";

/* Os status que CONTAM no quadro no cadastro do Léo depois do freelancer — é o
   que a tela passa (`d.status.filter(s => s.contaComoAtivo)`). */
const DISPONIVEIS = ["ativo", "experiencia", "aviso", "afastado", "atestado-medico", "abandono", "freelancer"];

const c = (o: Partial<Colaborador> & { id: string; nome: string }) => o as Colaborador;
const p = (colaboradorId: string, competencia: string, tipo: string, dataPagamento = "") =>
  ({ colaboradorId, competencia, tipo, dataPagamento }) as Pagamento;

describe("reativar quem continua recebendo — o caso ruim primeiro", () => {
  it("NÃO reativa quem só recebeu rescisão e férias depois de sair", () => {
    // É o acerto de quem saiu. Reativar aqui devolveria ao quadro alguém que
    // realmente foi embora, inflando headcount e custo do mês.
    const pessoas = [c({ id: "x", nome: "Saiu Mesmo", statusId: "inativo", dataDesligamento: "2026-06-22" })];
    const pags = [p("x", "2026-07", "Rescisão"), p("x", "2026-07", "Férias"), p("x", "2026-08", "13º Salário"), p("x", "2026-08", "FGTS")];
    expect(reativarQuemContinuaRecebendo(pessoas, pags)).toEqual([]);
  });

  it("NÃO reativa quem não tem data de desligamento — não há o que consertar", () => {
    const pessoas = [c({ id: "x", nome: "Ativa", statusId: "ativo" })];
    expect(reativarQuemContinuaRecebendo(pessoas, [p("x", "2026-08", "Salário")])).toEqual([]);
  });

  it("NÃO reativa por salário da MESMA competência da saída", () => {
    // Sair em 22/06 e receber o salário de junho é o normal do mundo.
    const pessoas = [c({ id: "x", nome: "Saiu Em Junho", statusId: "inativo", dataDesligamento: "2026-06-22" })];
    expect(reativarQuemContinuaRecebendo(pessoas, [p("x", "2026-06", "Salário")])).toEqual([]);
  });

  it("reativa quem recebeu SALÁRIO de competência posterior — o caso do Demerval e do Osmane", () => {
    const pessoas = [c({ id: "d", nome: "Demerval Vieira", statusId: "ativo", dataDesligamento: "2026-06-22" })];
    const pags = [
      p("d", "2026-07", "Adiantamento"), p("d", "2026-07", "Salário"),
      p("d", "2026-08", "Adiantamento"), p("d", "2026-08", "Salário"),
    ];
    const [r] = reativarQuemContinuaRecebendo(pessoas, pags);
    expect(r.mesQueProva).toBe("2026-08");
    expect(r.verbas).toEqual(["Adiantamento", "Salário"]);
    expect(r.para.dataDesligamento).toBeNull();
  });

  it("quem estava inativo vai para FREELANCER; quem já tinha outro status do quadro mantém o dele", () => {
    // Pedido do Léo em 07/09/2026: "ao invés de funcionário vai pra freelancer".
    // Quem parou de ser CLT e continua recebendo salário está na empreita.
    // Limpar só a data deixaria o inativo fora do quadro pelo outro lado.
    const inativo = c({ id: "o", nome: "Osmane", statusId: "inativo", dataDesligamento: "2026-06-22" });
    const emExp = c({ id: "e", nome: "Em Experiência", statusId: "experiencia", dataDesligamento: "2026-06-22" });
    const pags = [p("o", "2026-08", "Salário"), p("e", "2026-08", "Salário")];
    const r = reativarQuemContinuaRecebendo([inativo, emExp], pags, DISPONIVEIS);
    expect(r.find((x) => x.colaboradorId === "o")!.para.statusId).toBe("freelancer");
    expect(r.find((x) => x.colaboradorId === "e")!.para.statusId).toBe("experiencia");
  });

  /* O CASO RUIM DO STATUS NOVO: propor um id que o cadastro não tem.
     `contaHeadcount` faz `statusById.get(id)?.contaComoAtivo ?? false` — um id
     inexistente não dá erro nenhum, só SOME com a pessoa do quadro. Aplicar a
     correção deixaria o Léo pior do que antes, e calado. */
  it("cadastro SEM o status freelancer continua propondo ativo — nunca um id que não existe", () => {
    const inativo = c({ id: "o", nome: "Osmane", statusId: "inativo", dataDesligamento: "2026-06-22" });
    const pags = [p("o", "2026-08", "Salário")];
    expect(reativarQuemContinuaRecebendo([inativo], pags, ["ativo", "experiencia"])[0].para.statusId).toBe("ativo");
    // E quem nem passa a lista (não sabe o que existe) também cai no seguro.
    expect(reativarQuemContinuaRecebendo([inativo], pags)[0].para.statusId).toBe("ativo");
  });

  it("o freelancer é só o PADRÃO do seletor: a proposta não some com quem não é", () => {
    // A tela troca pessoa por pessoa antes de aplicar; a regra só sugere.
    const inativo = c({ id: "o", nome: "Osmane", statusId: "inativo", dataDesligamento: "2026-06-22" });
    const [r] = reativarQuemContinuaRecebendo([inativo], [p("o", "2026-08", "Salário")], DISPONIVEIS);
    expect(DISPONIVEIS).toContain(r.para.statusId);
    expect(r.de.statusId).toBe("inativo"); // o de-para continua legível na tela
  });

  it("guarda o estado ANTERIOR, para a tela mostrar o que muda", () => {
    const pessoas = [c({ id: "d", nome: "Demerval", statusId: "ativo", dataDesligamento: "2026-06-22" })];
    const [r] = reativarQuemContinuaRecebendo(pessoas, [p("d", "2026-08", "Salário")]);
    expect(r.de).toEqual({ statusId: "ativo", dataDesligamento: "2026-06-22" });
  });

  /* O CASO QUE A REGRA SE RECUSA A DECIDIR — e é bom que se recuse.
     José Adilando consta com saída em 03/08/2026 e recebeu salário da
     competência 2026-08. Parece contradição, mas a janela dessa competência vai
     de 16/07 a 15/08: ele trabalhou de 16/07 a 03/08, então esse salário é
     legítimo. Reativá-lo automaticamente devolveria ao quadro alguém que talvez
     tenha saído mesmo. Ele continua aparecendo na auditoria, para uma pessoa
     olhar — que é o certo. */
  it("saída no meio da competência NÃO é decidida sozinha: o salário do mês pode ser legítimo", () => {
    const pessoas = [c({ id: "j", nome: "José Adilando", statusId: "ativo", dataDesligamento: "2026-08-03" })];
    const pags = [p("j", "2026-08", "Salário"), p("j", "2026-08", "Adiantamento"), p("j", "2026-08", "Diária")];
    expect(reativarQuemContinuaRecebendo(pessoas, pags)).toEqual([]);
  });

  it("competência mal formada não vira prova de nada", () => {
    const pessoas = [c({ id: "x", nome: "X", statusId: "inativo", dataDesligamento: "2026-06-22" })];
    expect(reativarQuemContinuaRecebendo(pessoas, [p("x", "lixo", "Salário"), p("x", "", "Salário")])).toEqual([]);
  });

  it("sai em ordem de nome, para a lista da tela não dançar", () => {
    const pessoas = [
      c({ id: "b", nome: "Zeca", statusId: "inativo", dataDesligamento: "2026-01-01" }),
      c({ id: "a", nome: "Ana", statusId: "inativo", dataDesligamento: "2026-01-01" }),
    ];
    const pags = [p("b", "2026-08", "Salário"), p("a", "2026-08", "Salário")];
    expect(reativarQuemContinuaRecebendo(pessoas, pags).map((x) => x.nome)).toEqual(["Ana", "Zeca"]);
  });
});

describe("admissão anterior ao primeiro pagamento", () => {
  it("NÃO acusa quando só o RÓTULO da competência é anterior — a janela é 16→15", () => {
    // Quem entra em 06/07 recebe um título rotulado 2026-06 e isso é correto.
    // Acusar aqui recuaria a admissão de gente certa.
    const pessoas = [c({ id: "r", nome: "Reinaldo", dataAdmissao: "2026-07-06" })];
    const pags = [p("r", "2026-06", "Adiantamento", "2026-07-20")];
    expect(admissaoAnteriorAoPrimeiroPagamento(pessoas, pags)).toEqual([]);
  });

  it("acusa quando o VENCIMENTO é anterior à admissão — o caso do Thiago", () => {
    const pessoas = [c({ id: "t", nome: "Thiago", dataAdmissao: "2026-07-29" })];
    const pags = [
      p("t", "2026-05", "Salário", "2026-06-05"),
      p("t", "2026-06", "Adiantamento", "2026-06-22"),
      p("t", "2026-08", "Salário", "2026-09-04"),
    ];
    const [r] = admissaoAnteriorAoPrimeiroPagamento(pessoas, pags);
    expect(r.primeiraComp).toBe("2026-05");
    expect(r.primeiroVenc).toBe("2026-06-05");
    expect(r.para.dataAdmissao).toBe("2026-05-01");
    expect(r.faltando).toBe(false);
  });

  it("quem não tem admissão nenhuma entra marcado como FALTANDO — o caso do Fabio", () => {
    const pessoas = [c({ id: "f", nome: "Fabio" })];
    const [r] = admissaoAnteriorAoPrimeiroPagamento(pessoas, [p("f", "2026-08", "Salário", "2026-09-04")]);
    expect(r.faltando).toBe(true);
    expect(r.para.dataAdmissao).toBe("2026-08-01");
  });

  it("a proposta é um PISO: o primeiro dia da competência mais antiga, nunca depois dela", () => {
    const pessoas = [c({ id: "l", nome: "Leonardo", dataAdmissao: "2025-12-01" })];
    const pags = [p("l", "2025-11", "Adiantamento", "2025-11-20"), p("l", "2025-11", "Freelancer (Empreita)", "2025-11-20")];
    const [r] = admissaoAnteriorAoPrimeiroPagamento(pessoas, pags);
    expect(r.para.dataAdmissao).toBe("2025-11-01");
    expect(r.para.dataAdmissao < r.primeiroVenc).toBe(true);
  });

  it("quem não tem pagamento nenhum fica de fora — não há de onde deduzir", () => {
    expect(admissaoAnteriorAoPrimeiroPagamento([c({ id: "z", nome: "Zé" })], [])).toEqual([]);
  });

  it("pagamento sem vencimento não acusa admissão errada", () => {
    const pessoas = [c({ id: "x", nome: "X", dataAdmissao: "2026-07-01" })];
    expect(admissaoAnteriorAoPrimeiroPagamento(pessoas, [p("x", "2026-05", "Salário", "")])).toEqual([]);
  });
});

describe("as duas regras não brigam entre si", () => {
  it("uma pessoa pode aparecer nas duas listas sem que uma anule a outra", () => {
    // Admissão errada e data de saída errada são consertos independentes.
    const pessoas = [c({ id: "x", nome: "Dois Problemas", statusId: "inativo", dataAdmissao: "2026-07-01", dataDesligamento: "2026-06-22" })];
    const pags = [p("x", "2026-05", "Salário", "2026-06-05"), p("x", "2026-08", "Salário", "2026-09-04")];
    expect(reativarQuemContinuaRecebendo(pessoas, pags)).toHaveLength(1);
    expect(admissaoAnteriorAoPrimeiroPagamento(pessoas, pags)).toHaveLength(1);
  });
});

/* O seletor "fica como" — o que a tela OFERECE tem de conter o que ela vai
   aplicar. Um <select> com value fora das options mostra a primeira e mente. */
describe("as opções do seletor de destino", () => {
  const doQuadro = [{ id: "ativo", nome: "Ativo" }, { id: "freelancer", nome: "Freelancer" }];

  it("o caso ruim: o selecionado NÃO está na lista — entra, para a tela não mentir", () => {
    // Quem é "Externo" (fora do headcount) com data de saída errada: a regra
    // preserva o status dele, que não aparece na lista dos que contam.
    expect(opcoesDeStatus(doQuadro, "externo").map((o) => o.id)).toEqual(["ativo", "freelancer", "externo"]);
  });

  it("não mexe na lista quando o selecionado já está nela", () => {
    expect(opcoesDeStatus(doQuadro, "freelancer")).toBe(doQuadro);
  });

  it("lista vazia devolve pelo menos o selecionado — nunca um seletor sem opção", () => {
    expect(opcoesDeStatus([], "ativo")).toEqual([{ id: "ativo", nome: "ativo" }]);
  });
});
