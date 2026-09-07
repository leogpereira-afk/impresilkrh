/* Desligar na ficha: o botão e o aviso.
 *
 * O que está em jogo: `noQuadro` é `statusId !== "inativo" && !dataDesligamento`
 * — a DATA SOZINHA tira a pessoa do quadro. Combinação errada aqui é a causa
 * número um do achado "cadastro contradiz os pagamentos": a pessoa some do mês
 * e a ficha dela abre vazia, sem nada explicar.
 *
 * Começa pelo caso ruim.
 */
import { describe, it, expect } from "vitest";
import { desligamentoDeHoje, avisoDoDesligamento, podeDesligar } from "./desligamento";
import { STATUS } from "@/data/status";

describe("o botão desliga com a data de hoje", () => {
  it("grava inativo e a data do dia em que se aperta", () => {
    const r = desligamentoDeHoje(new Date(2026, 8, 7, 23, 30));
    expect(r).toEqual({ statusId: "inativo", dataDesligamento: "2026-09-07" });
  });

  it("usa o dia LOCAL, não o UTC — às 23h30 de Brasília ainda é hoje", () => {
    // new Date().toISOString() daria 2026-09-08 aqui e desligaria a pessoa no
    // dia seguinte, mudando o mês em virada de mês.
    const r = desligamentoDeHoje(new Date(2026, 7, 31, 23, 30));
    expect(r.dataDesligamento).toBe("2026-08-31");
    expect(r.dataDesligamento).not.toBe(new Date(2026, 7, 31, 23, 30).toISOString().slice(0, 10));
  });

  it("o botão só faz sentido para quem ainda não tem data", () => {
    expect(podeDesligar("ativo", null)).toBe(true);
    expect(podeDesligar("inativo", null)).toBe(true); // inativo sem data: falta a data
    expect(podeDesligar("inativo", "2026-08-31")).toBe(false);
    expect(podeDesligar("ativo", "2026-08-31")).toBe(false); // já tem data: o que falta é editar
  });
});

describe("o aviso embaixo dos dois campos", () => {
  it("ativo e sem data não vira ruído nenhum", () => {
    expect(avisoDoDesligamento("ativo", null, STATUS)).toBeNull();
    expect(avisoDoDesligamento("ativo", "", STATUS)).toBeNull();
    expect(avisoDoDesligamento("experiencia", null, STATUS)).toBeNull();
  });

  it("inativo SEM data é erro — é o achado da auditoria", () => {
    const a = avisoDoDesligamento("inativo", null, STATUS)!;
    expect(a.tom).toBe("erro");
    expect(a.texto).toContain("desde quando");
  });

  /* Status "ativo" é caso à parte e o aviso quase mentiu aqui. O `salvar` do
     formulário faz `dataDesligamento: statusId === "ativo" ? null : …` — a data
     é APAGADA, a pessoa NÃO sai do quadro. O primeiro texto que escrevi dizia
     "sai do quadro", o contrário do que acontece. */
  it("Ativo com data: avisa que a data será APAGADA ao salvar, não que ela vale", () => {
    const a = avisoDoDesligamento("ativo", "2026-08-31", STATUS)!;
    expect(a.tom).toBe("erro");
    expect(a.texto).toContain("apagada");
    expect(a.texto).not.toContain("sai do quadro");
  });

  it("os outros status do quadro GUARDAM a data — e aí é contradição de verdade", () => {
    // "Aviso prévio", "Em experiência" e "Afastado" contam no headcount e o
    // salvar preserva a data: `noQuadro` exige data vazia, então a pessoa some
    // do quadro enquanto o status diz que ela está lá.
    for (const [id, nome] of [["aviso", "Aviso prévio"], ["experiencia", "Em experiência"], ["afastado", "Afastado"]]) {
      const a = avisoDoDesligamento(id, "2026-09-30", STATUS)!;
      expect(a.tom, id).toBe("erro");
      expect(a.texto, id).toContain("sai do quadro");
      expect(a.texto, id).toContain(nome);
    }
  });

  it("Direção e Externo com data: avisa o efeito, mas não trata como erro", () => {
    const a = avisoDoDesligamento("direcao", "2026-08-31", STATUS)!;
    expect(a.tom).toBe("atencao");
    expect(a.texto).toContain("Direção");
    expect(avisoDoDesligamento("externo", "2026-08-31", STATUS)!.tom).toBe("atencao");
  });

  it("inativo COM data é o caminho certo: informa e diz que dá para corrigir", () => {
    const a = avisoDoDesligamento("inativo", "2026-08-31", STATUS)!;
    expect(a.tom).toBe("info");
    expect(a.texto).toContain("corrigir");
  });

  it("status desconhecido não quebra o aviso", () => {
    // Status é coleção editável: alguém pode criar um id que não está em STATUS.
    const a = avisoDoDesligamento("inventado", "2026-08-31", STATUS)!;
    expect(a.tom).toBe("atencao");
    expect(a.texto).toContain("inventado");
  });

  it("a data com hora junto é lida só até o dia", () => {
    expect(avisoDoDesligamento("inativo", "2026-08-31T00:00:00", STATUS)!.tom).toBe("info");
  });

  it("o botão e o aviso concordam: onde o botão some, ou está certo ou o aviso explica", () => {
    for (const s of STATUS) {
      // Sem data o botão aparece; com data ele some e sobra o aviso quando há erro.
      expect(podeDesligar(s.id, null)).toBe(true);
      expect(podeDesligar(s.id, "2026-08-31")).toBe(false);
      const a = avisoDoDesligamento(s.id, "2026-08-31", STATUS);
      expect(a, `status "${s.id}" com data ficou sem aviso nenhum`).not.toBeNull();
    }
  });
});
