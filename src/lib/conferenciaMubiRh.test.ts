/* Conferência do cadastro: RH × módulo de RH do Mubisys (22/09/2026).
 *
 * As linhas usadas aqui foram COPIADAS da tela do ERP do Léo, não inventadas —
 * inclusive as tortas: o Dermeval está lá com um CPF de 10 dígitos, e um nome
 * vem com erro de digitação ("comunicaç~çao visual"). Teste com dado limpo não
 * prova nada sobre um cadastro de verdade.
 *
 * Começa pelo caso ruim: engolir linha em silêncio. Uma lista de 30 que lê 27 e
 * não avisa faz três pessoas sumirem da conferência — e some junto o defeito
 * delas, que é justamente o que se foi procurar.
 */
import { describe, it, expect } from "vitest";
import {
  conferirComMubisys,
  cpfValido,
  dataIso,
  lerListaMubisys,
  resumoDaConferencia,
  type FichaRh,
} from "./conferenciaMubiRh";

const REAL = `Situação Nome CPF Data de admissão Data de demissão Profissão Telefone Salário base Total Tipo Acessar sistema

Adilson Barbosa Fonseca 083.421.036-33 13/01/2014 Atendente extreno +55 (38) 9940-7547 R$ 1.955,43 R$ 1.996,37 Produção

Demerval Vieira 965640246-9 20/01/2026 Designer +55 (38) 99107-5055 R$ 2.140,00 R$ 2.097,53 Produção

Charles Alves Dias 958.911.886-00 01/12/2025 Operador de comunicaç~çao visual +55 (38) 8864-0963 R$ 1.872,50 R$ 1.871,94 Produção

Victor Douglas Lopes Siqueira 159.382.836-55 02/03/2026 Operador de Comunicação Visual +55 (38) 99872-0852 R$ 1.872,50 R$ 1.878,46 Produção

Total: 30 Colaboradores`;

describe("o caso ruim: linha engolida em silêncio", () => {
  it("linha que parece gente e não dá para ler volta em naoLidas", () => {
    const r = lerListaMubisys("Fulano De Tal sem documento nenhum aqui");
    expect(r.linhas).toHaveLength(0);
    expect(r.naoLidas).toEqual(["Fulano De Tal sem documento nenhum aqui"]);
  });

  it("ruído da cópia NÃO vira alarme — senão ninguém lê o aviso", () => {
    // Contadores, ícones e rodapé vêm junto quando se seleciona a tabela.
    const r = lerListaMubisys("150\n8\n79\nBuscar\nAdicionar\nTotal: 30 Colaboradores");
    expect(r.linhas).toHaveLength(0);
    expect(r.naoLidas).toHaveLength(0);
  });

  it("o cabeçalho da tabela do ERP não vira pessoa", () => {
    const r = lerListaMubisys(REAL);
    expect(r.linhas.map((l) => l.nome)).not.toContain("Situação Nome CPF Data de admissão");
    expect(r.naoLidas).toHaveLength(0);
  });
});

describe("lendo a lista real do Mubisys", () => {
  const r = lerListaMubisys(REAL);

  it("lê as quatro pessoas, com nome inteiro", () => {
    expect(r.linhas.map((l) => l.nome)).toEqual([
      "Adilson Barbosa Fonseca",
      "Demerval Vieira",
      "Charles Alves Dias",
      "Victor Douglas Lopes Siqueira",
    ]);
  });

  it("nome de quatro palavras não quebra a leitura", () => {
    // Ler por POSIÇÃO quebraria aqui; o nome é o que sobra antes do CPF.
    expect(r.linhas[3].nome).toBe("Victor Douglas Lopes Siqueira");
    expect(r.linhas[3].cpf).toBe("159.382.836-55");
  });

  it("O CPF TORTO É LIDO, não descartado — é ele que precisa aparecer", () => {
    // O Dermeval está no Mubisys com 10 dígitos. Recusar a linha esconderia
    // exatamente o defeito que a conferência existe para achar.
    expect(r.linhas[1].cpf).toBe("965640246-9");
  });

  it("admissão, telefone, salário e tipo saem separados", () => {
    const a = r.linhas[0];
    expect(a.admissao).toBe("13/01/2014");
    expect(a.demissao).toBe("");
    expect(a.telefone).toBe("+55 (38) 9940-7547");
    expect(a.salario).toBe("R$ 1.955,43");
    expect(a.tipo).toBe("Produção");
  });

  it("profissão com erro de digitação vem como está — não é a tela que conserta", () => {
    expect(r.linhas[2].profissao).toContain("comunicaç~çao visual");
  });
});

describe("a conferência não decide quem está certo", () => {
  const fichas: FichaRh[] = [
    { id: "adilson", nome: "Adilson Barbosa Fonseca", cpf: "08342103633", dataAdmissao: "2014-01-13", telefone: "(38) 99940-7547" },
    { id: "victor", nome: "Victor Douglas Lopes Siqueira", cpf: "15938283655", dataAdmissao: "2026-08-10" },
    { id: "dermeval", nome: "Demerval Vieira", cpf: "21378946960", dataAdmissao: "2026-01-20" },
    { id: "charles", nome: "Charles Alves Dias", cpf: "95891188600", dataAdmissao: "2025-12-01" },
    { id: "osmane", nome: "Osmane Vinicius Nepomuceno Oliveira", cpf: "12986531695" },
  ];
  const c = conferirComMubisys(fichas, lerListaMubisys(REAL));
  const de = (id: string) => c.pares.find((p) => p.ficha.id === id)!;

  it("O CASO RUIM: a divergência mostra OS DOIS LADOS, sem eleger vencedor", () => {
    // Em cinco casos reais eu não tinha como saber qual lado valia. Um
    // "corrigir automaticamente" gravaria o errado em silêncio.
    const d = de("victor").divergencias.find((x) => x.campo === "Admissão")!;
    expect(d.noRh).toBe("2026-08-10");
    expect(d.noMubisys).toBe("2026-03-02");
    // E fica VISÍVEL, mas sem botão: o Léo decidiu não mexer na admissão
    // (22/09). Decisão tomada não é defeito — mas apagar a informação seria
    // esconder que os dois sistemas discordam em cinco meses.
    expect(d.naoAplicavel).toContain("fica como está");
  });

  it("quem bate não vira divergência", () => {
    expect(de("adilson").divergencias.filter((d) => !d.falta)).toHaveLength(0);
    expect(de("charles").divergencias.filter((d) => !d.falta)).toHaveLength(0);
  });

  it("campo VAZIO no RH entra como 'falta', não como discordância", () => {
    // Completar o que falta é metade do trabalho de uma conferência. Antes só
    // entrava quando os dois lados tinham valor, então vazio nunca aparecia.
    const d = de("charles").divergencias.find((x) => x.campo === "Telefone")!;
    expect(d.falta).toBe(true);
    expect(d.noRh).toBe("");
    expect(d.naoAplicavel).toBeUndefined();
  });

  it("o Dermeval casa pelo NOME e a divergência é o CPF", () => {
    // Se a conferência só casasse por id, ele viraria duas pessoas — uma "só
    // no RH" e outra "só no Mubisys" — e o documento divergente sumia.
    const p = de("dermeval");
    expect(p.casadoPor).toBe("nome");
    expect(p.divergencias.map((d) => d.campo)).toContain("CPF");
    const cpf = p.divergencias.find((d) => d.campo === "CPF")!;
    expect(cpf.noMubisys).toBe("965640246-9");
  });

  it("O CASO RUIM: CPF quebrado do ERP NÃO pode ser aplicado sobre o bom", () => {
    // O do Dermeval tem 10 dígitos no Mubisys. "Usar o do Mubisys" ali
    // trocaria um documento bom por um inválido — aqui quem está errado é o
    // ERP, e a tela precisa dizer isso em vez de oferecer o botão.
    const cpf = de("dermeval").divergencias.find((d) => d.campo === "CPF")!;
    expect(cpf.naoAplicavel).toContain("10 dígitos");
  });

  it("casamento por ID é declarado como tal — o resto é palpite e a tela precisa saber", () => {
    expect(de("adilson").casadoPor).toBe("id");
  });

  it("quem só existe de um lado aparece de um lado só", () => {
    expect(c.soNoRh.map((f) => f.id)).toEqual(["osmane"]);
    expect(c.soNoMubisys).toHaveLength(0);
  });

  it("telefone compara pelos últimos 8 dígitos — DDI e nono dígito não são divergência", () => {
    // O ERP grava "+55 (38) 9940-7547" e o RH "(38) 99940-7547". Acusar isso
    // encheria a tela de 30 divergências falsas e ninguém leria as reais.
    expect(de("adilson").divergencias.find((d) => d.campo === "Telefone")).toBeUndefined();
  });

  it("o resumo conta tudo, inclusive o que não deu para ler", () => {
    const comLixo = conferirComMubisys(fichas, lerListaMubisys(REAL + "\nZé Ninguém sem nada"));
    const r = resumoDaConferencia(comLixo);
    expect(r).toContain("1 linha(s) não entendida(s)");
    expect(r).toContain("faltando no RH");
    expect(r).toContain("em que discordam");
    expect(r).toContain("1 só no RH");
  });
});

describe("as peças soltas", () => {
  it("data brasileira vira ISO, e o que não é data vira vazio", () => {
    expect(dataIso("02/03/2026")).toBe("2026-03-02");
    expect(dataIso("")).toBe("");
    expect(dataIso("2026-03-02")).toBe("");
    expect(dataIso(null)).toBe("");
  });

  it("ficha sem CPF não casa por id e não estoura", () => {
    const c = conferirComMubisys([{ id: "x", nome: "Adilson Barbosa Fonseca" }], lerListaMubisys(REAL));
    expect(c.pares[0].casadoPor).toBe("nome");
    // O CPF entra como FALTA (o RH não tem, o ERP tem) — e dá para preencher.
    const cpf = c.pares[0].divergencias.find((d) => d.campo === "CPF")!;
    expect(cpf.falta).toBe(true);
    expect(cpf.naoAplicavel).toBeUndefined();
  });

  it("cpfValido só aceita 11 dígitos", () => {
    expect(cpfValido("083.421.036-33")).toBe(true);
    expect(cpfValido("08342103633")).toBe(true);
    expect(cpfValido("965640246-9")).toBe(false);
    expect(cpfValido("")).toBe(false);
    expect(cpfValido(null)).toBe(false);
  });
});
