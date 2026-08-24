/* O DOSSIÊ QUE APARECE NA HORA DA CONVERSA.
 *
 * O pedido: a tela de Feedback só mostrava o agendamento, e quem ia conversar
 * chegava sem saber nada — faltas, ganhos variáveis, perfil, treinamento.
 * Tudo isso já estava no sistema, em quatro telas diferentes.
 *
 * O que estes testes protegem, acima de tudo: DADO QUE NÃO EXISTE NÃO VIRA
 * ZERO. "Nenhuma falta" e "não temos o ponto dessa pessoa" são fatos opostos,
 * e confundir os dois faz o líder elogiar a assiduidade de alguém que ninguém
 * mediu.
 */
import { describe, it, expect } from "vitest";
import {
  assiduidade, ganhosAlemDoSalario, perfilParaConversa, desenvolvimento,
  dossieDoColaborador, competenciasDaJanela, JANELA_MESES,
} from "./dossieFeedback";

const HOJE = new Date("2026-08-19T12:00:00");
const EU = "ana";

describe("a janela de tempo", () => {
  it("são os 3 meses até o atual, do mais novo para o mais velho", () => {
    expect(competenciasDaJanela(HOJE)).toEqual(["2026-08", "2026-07", "2026-06"]);
  });
  it("vira o ano para trás sem quebrar", () => {
    expect(competenciasDaJanela(new Date("2026-01-15T12:00:00"))).toEqual(["2026-01", "2025-12", "2025-11"]);
  });
});

describe("assiduidade", () => {
  const ponto = (competencia: string, extra = {}) =>
    ({ colaboradorId: EU, competencia, faltasMin: 0, extrasMin: 0, dias: [], ...extra });

  it("SEM PONTO devolve temDados=false, não 'zero faltas'", () => {
    const a = assiduidade([], EU, HOJE);
    expect(a.temDados).toBe(false);
    expect(a.faltas).toBe(0); // o número existe, mas a tela não pode mostrá-lo
  });

  it("com ponto e nenhuma falta, temDados=true e faltas=0", () => {
    // Este é o caso OPOSTO do de cima, e a diferença é toda a informação.
    const a = assiduidade([ponto("2026-08")], EU, HOJE);
    expect(a.temDados).toBe(true);
    expect(a.faltas).toBe(0);
  });

  it("conta faltas e atestados pelos dias, separados", () => {
    const a = assiduidade([ponto("2026-08", {
      dias: [{ situacao: "falta" }, { situacao: "falta" }, { situacao: "atestado" }, { situacao: "normal" }],
    })], EU, HOJE);
    expect(a.faltas).toBe(2);
    expect(a.atestados).toBe(1);
  });

  it("soma horas extras e de falta em horas decimais", () => {
    const a = assiduidade([
      ponto("2026-08", { extrasMin: 170, faltasMin: 60 }),
      ponto("2026-07", { extrasMin: 130 }),
    ], EU, HOJE);
    expect(a.horasExtras).toBeCloseTo(5, 2);
    expect(a.horasFalta).toBeCloseTo(1, 2);
    expect(a.meses).toBe(2);
  });

  it("ignora mês fora da janela e ponto de outra pessoa", () => {
    const a = assiduidade([
      ponto("2026-01", { dias: [{ situacao: "falta" }] }),
      { ...ponto("2026-08", { dias: [{ situacao: "falta" }] }), colaboradorId: "outro" },
    ], EU, HOJE);
    expect(a.temDados).toBe(false);
  });
});

describe("ganhos além do salário", () => {
  const pg = (tipo: string, valor: number, competencia = "2026-08") =>
    ({ colaboradorId: EU, competencia, tipo, valor });

  it("não conta salário nem adiantamento — é a mesma remuneração combinada", () => {
    const g = ganhosAlemDoSalario([pg("Salário", 2000), pg("Adiantamento", 800)], EU, HOJE);
    expect(g.temDados).toBe(true);
    expect(g.total).toBe(0);
    expect(g.porTipo).toEqual([]);
  });

  it("não conta férias, rescisão, VT nem plano — direito, não desempenho", () => {
    const g = ganhosAlemDoSalario(
      [pg("Férias", 1500), pg("Vale Transporte", 200), pg("Plano de Saúde", 300)], EU, HOJE);
    expect(g.total).toBe(0);
  });

  it("soma hora extra, comissão e incentivo, do maior para o menor", () => {
    const g = ganhosAlemDoSalario([
      pg("Horas Extras", 240.5), pg("Comissão", 800), pg("Horas Extras", 100),
      pg("Incentivo de Produtividade", 300),
    ], EU, HOJE);
    expect(g.total).toBeCloseTo(1440.5, 2);
    expect(g.porTipo.map((x) => x.tipo)).toEqual(["Comissão", "Horas Extras", "Incentivo de Produtividade"]);
    expect(g.porTipo[1].valor).toBeCloseTo(340.5, 2);
  });

  it("SEM PAGAMENTO devolve temDados=false, não 'ganhou zero'", () => {
    expect(ganhosAlemDoSalario([], EU, HOJE).temDados).toBe(false);
  });

  it("só com salário: temDados=true e total 0 — ela recebeu, e nada além", () => {
    const g = ganhosAlemDoSalario([pg("Salário", 2000)], EU, HOJE);
    expect(g.temDados).toBe(true);
    expect(g.total).toBe(0);
  });
});

describe("perfil para a conversa", () => {
  it("puxa a orientação de FEEDBACK do arquétipo, não uma genérica", () => {
    const p = perfilParaConversa({ perfilComportamental: "Colérico" });
    expect(p.temDados).toBe(true);
    expect(typeof p.comoFalar).toBe("string");
    expect((p.comoFalar ?? "").length).toBeGreaterThan(10);
    expect(p.noticiaRuim).toBeTruthy();
    expect(p.fortesDoPerfil?.length).toBeGreaterThan(0);
  });

  it("sem nada preenchido, temDados=false", () => {
    expect(perfilParaConversa({}).temDados).toBe(false);
  });

  it("perfil desconhecido não estoura — devolve o que tem", () => {
    const p = perfilParaConversa({ perfilComportamental: "Inventado", humor: "Motivado" });
    expect(p.temDados).toBe(true);
    expect(p.comoFalar).toBeUndefined();
    expect(p.humor).toBe("Motivado");
  });
});

describe("desenvolvimento", () => {
  it("separa treinamento concluído de pendente", () => {
    const d = desenvolvimento([
      { colaboradorId: EU, titulo: "NR-35", status: "Concluído", concluidoEm: "2026-07-10" },
      { colaboradorId: EU, titulo: "NR-12", status: "Em andamento" },
    ], [], EU);
    expect(d.concluidos.map((c) => c.titulo)).toEqual(["NR-35"]);
    expect(d.pendentes).toEqual(["NR-12"]);
  });

  it("compara a última avaliação com a anterior e diz a tendência", () => {
    const d = desenvolvimento([], [
      { colaboradorId: EU, notaFinal: 82, criadoEm: "2026-07-01" },
      { colaboradorId: EU, notaFinal: 74, criadoEm: "2026-01-01" },
    ], EU);
    expect(d.notaFinal).toBe(82);
    expect(d.tendencia).toBe("subiu");
  });

  it("uma avaliação só não inventa tendência", () => {
    const d = desenvolvimento([], [{ colaboradorId: EU, notaFinal: 82, criadoEm: "2026-07-01" }], EU);
    expect(d.tendencia).toBeNull();
  });

  it("sem treinamento e sem avaliação, temDados=false", () => {
    expect(desenvolvimento([], [], EU).temDados).toBe(false);
  });
});

describe("o dossiê inteiro", () => {
  it("lista o que veio VAZIO, para a tela avisar em vez de fingir", () => {
    const d = dossieDoColaborador({ id: EU }, {}, HOJE);
    expect(d.semDados).toEqual(["ponto", "pagamentos", "perfil comportamental", "treinamento e avaliação"]);
    expect(d.janelaMeses).toBe(JANELA_MESES);
  });

  it("com tudo preenchido, semDados fica vazio", () => {
    const d = dossieDoColaborador(
      { id: EU, perfilComportamental: "Colérico" },
      {
        pontos: [{ colaboradorId: EU, competencia: "2026-08", dias: [] }],
        pagamentos: [{ colaboradorId: EU, competencia: "2026-08", tipo: "Comissão", valor: 100 }],
        treinamentos: [{ colaboradorId: EU, titulo: "NR-35", status: "Concluído" }],
        avaliacoes: [{ colaboradorId: EU, notaFinal: 80, criadoEm: "2026-07-01" }],
      },
      HOJE,
    );
    expect(d.semDados).toEqual([]);
    expect(d.ganhos.total).toBe(100);
  });
});
