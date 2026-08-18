import { describe, it, expect } from "vitest";
import {
  diasUteisDeTeste, avisoDoTeste, pendenciasDoTeste, LIMITE_DIAS_TESTE,
  textoDevolutiva, MOTIVOS_DEVOLUTIVA, estaNoBanco,
} from "./selecao";

/* Segunda 10/08/2026 a sexta 14/08/2026 é uma semana cheia — as datas dos
   testes saem daí para ficar fácil conferir na mão. */
describe("contagem dos dias de teste", () => {
  it("segunda a sexta dá 5 dias úteis", () => {
    expect(diasUteisDeTeste("2026-08-10", "2026-08-14")).toBe(5);
  });

  it("um dia só conta 1 (conta os dois extremos)", () => {
    expect(diasUteisDeTeste("2026-08-10", "2026-08-10")).toBe(1);
  });

  it("o fim de semana no meio NÃO conta", () => {
    /* Sexta a segunda seguinte são 4 dias corridos, mas a pessoa trabalhou 2.
       Contar corrido faria a tela acusar limite estourado sem ninguém ter
       trabalhado a mais. */
    expect(diasUteisDeTeste("2026-08-14", "2026-08-17")).toBe(2);
  });

  it("sábado e domingo sozinhos dão zero", () => {
    expect(diasUteisDeTeste("2026-08-15", "2026-08-16")).toBe(0);
  });

  it("duas semanas cheias dão 10, não 12", () => {
    expect(diasUteisDeTeste("2026-08-10", "2026-08-21")).toBe(10);
  });

  it("sem data, ou com data impossível, devolve null — nunca zero", () => {
    /* Zero dia é um FATO ("não teve teste"). Confundir os dois faria a tela
       dizer "dentro do limite" justamente quando não se sabe nada. */
    expect(diasUteisDeTeste(null, "2026-08-14")).toBeNull();
    expect(diasUteisDeTeste("2026-08-10", null)).toBeNull();
    expect(diasUteisDeTeste("20266-08-10", "2026-08-14")).toBeNull(); // ano de 5 dígitos
    expect(diasUteisDeTeste("2026-08-14", "2026-08-10")).toBeNull();  // fim antes do início
  });
});

describe("o que a tela avisa", () => {
  it("dentro do limite não alarma", () => {
    const a = avisoDoTeste({ testeInicio: "2026-08-10", testeFim: "2026-08-14" });
    expect(a.nivel).toBeNull();
    expect(a.dias).toBe(LIMITE_DIAS_TESTE);
  });

  it("passar do limite é AVISO, não erro — o fato já aconteceu", () => {
    /* Travar aqui faria o RH mudar a data para caber, e o registro passaria a
       mentir. O certo é deixar gravar e deixar visível. */
    const a = avisoDoTeste({ testeInicio: "2026-08-10", testeFim: "2026-08-18" });
    expect(a.nivel).toBe("aviso");
    expect(a.dias).toBe(7);
    expect(a.texto).toContain("passou do limite");
  });

  it("fim antes do início é ERRO — isso é digitação, não fato", () => {
    expect(avisoDoTeste({ testeInicio: "2026-08-14", testeFim: "2026-08-10" }).nivel).toBe("erro");
  });

  it("teste em andamento (sem último dia) não é erro", () => {
    const a = avisoDoTeste({ testeInicio: "2026-08-10", testeFim: null });
    expect(a.nivel).toBeNull();
    expect(a.texto).toContain("em andamento");
  });

  it("nada preenchido não diz nada", () => {
    expect(avisoDoTeste({}).nivel).toBeNull();
    expect(avisoDoTeste({}).texto).toBe("");
  });
});

describe("pendências do registro", () => {
  it("teste fechado, aprovado e pago não tem pendência", () => {
    expect(pendenciasDoTeste({
      testeInicio: "2026-08-10", testeFim: "2026-08-14",
      testeResultado: "Aprovado", testePago: true,
    })).toEqual([]);
  });

  it("cobra o pagamento — é o que protege a empresa depois", () => {
    const p = pendenciasDoTeste({
      testeInicio: "2026-08-10", testeFim: "2026-08-14",
      testeResultado: "Aprovado", testePago: false,
    });
    expect(p.join(" ")).toContain("pagamento");
  });

  it("não aprovado sem parecer fica pendente", () => {
    const p = pendenciasDoTeste({
      testeInicio: "2026-08-10", testeFim: "2026-08-14",
      testeResultado: "Não aprovado", testePago: true, testeParecer: "  ",
    });
    expect(p.join(" ")).toContain("parecer");
  });

  it("aprovado não exige parecer", () => {
    const p = pendenciasDoTeste({
      testeInicio: "2026-08-10", testeFim: "2026-08-14",
      testeResultado: "Aprovado", testePago: true,
    });
    expect(p.join(" ")).not.toContain("parecer");
  });

  it("teste em andamento cobra o fecho, não o pagamento", () => {
    const p = pendenciasDoTeste({ testeInicio: "2026-08-10", testeFim: null });
    expect(p.join(" ")).toContain("último dia");
    expect(p.join(" ")).not.toContain("pagamento");
  });
});

describe("texto da devolutiva", () => {
  it("chama pelo primeiro nome e cita a vaga", () => {
    const t = textoDevolutiva({ nome: "Maria Aparecida Souza", vaga: "Montador", motivo: "outro-perfil" });
    expect(t).toContain("Oi, Maria!");
    expect(t).toContain("vaga de Montador");
  });

  it("sem vaga, não inventa vaga nenhuma", () => {
    const t = textoDevolutiva({ nome: "João", motivo: "experiencia" });
    expect(t).not.toContain("vaga de");
    expect(t).toContain("processo");
  });

  it("não fala da PESSOA, só do que a vaga pedia", () => {
    /* Motivo que descreve quem a pessoa é ("não tem o perfil", "postura") é
       onde nasce reclamação por discriminação. */
    for (const m of MOTIVOS_DEVOLUTIVA) {
      const t = textoDevolutiva({ nome: "Ana", motivo: m.chave }).toLowerCase();
      expect(t).not.toContain("seu perfil não");
      expect(t).not.toContain("postura");
      expect(t).not.toContain("infelizmente você");
    }
  });

  it("quando o motivo JÁ é guardar o currículo, não promete isso duas vezes", () => {
    // Sem a guarda, sairia "guardamos seu currículo... Seu currículo fica no
    // nosso banco..." — a mesma promessa repetida em duas frases seguidas.
    const t = textoDevolutiva({ nome: "Ana", motivo: "banco" });
    expect(t.match(/currículo/gi)?.length).toBe(1);
  });

  it("nos outros motivos, a promessa do banco aparece uma vez", () => {
    const t = textoDevolutiva({ nome: "Ana", motivo: "outro-perfil" });
    expect(t.match(/currículo/gi)?.length).toBe(1);
    expect(t).toContain("banco");
  });

  it("nome vazio não gera 'Oi, !'", () => {
    expect(textoDevolutiva({ nome: "   ", motivo: "outro-perfil" })).toContain("Oi, Olá!");
  });
});

describe("banco de talentos", () => {
  it("currículo que chegou sem vaga está no banco", () => {
    expect(estaNoBanco({ vagaId: null, etapa: "Triagem" })).toBe(true);
  });

  it("candidato de uma vaga só entra no banco quando o RH guarda", () => {
    expect(estaNoBanco({ vagaId: "v1", etapa: "Reprovado" })).toBe(false);
    expect(estaNoBanco({ vagaId: "v1", etapa: "Reprovado", noBanco: true })).toBe(true);
  });

  it("contratado NUNCA está no banco", () => {
    // Virou colaborador; continuar aparecendo como currículo disponível
    // confunde justamente na hora de buscar gente.
    expect(estaNoBanco({ vagaId: null, etapa: "Contratado" })).toBe(false);
    expect(estaNoBanco({ vagaId: "v1", etapa: "Contratado", noBanco: true })).toBe(false);
  });
});
