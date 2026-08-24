/* A % DE PREENCHIMENTO DA FICHA.
 *
 * O que estes testes protegem: a porcentagem sozinha engana. Uma média simples
 * dos campos daria ~90% para quem está sem CPF — e a direção leria "quase
 * pronto" numa ficha que não admite ninguém. Por isso os campos têm peso e o
 * essencial faltando estoura a cor independentemente do número.
 */
import { describe, it, expect } from "vitest";
import {
  completudeDaFicha, preenchido, tomDaCompletude, CAMPOS_FICHA,
} from "./completudeCadastro";

const cheia = () => {
  const c: Record<string, unknown> = {};
  for (const campo of CAMPOS_FICHA) c[campo.chave] = "x";
  c.salario = 2000;
  c.qtdFilhos = 0;
  return c;
};

describe("preenchido", () => {
  it("vazio, nulo e só espaço não contam", () => {
    expect(preenchido("")).toBe(false);
    expect(preenchido("   ")).toBe(false);
    expect(preenchido(null)).toBe(false);
    expect(preenchido(undefined)).toBe(false);
    expect(preenchido([])).toBe(false);
  });

  it("zero não conta — salário 0 é ficha incompleta, não salário zero", () => {
    expect(preenchido(0)).toBe(false);
  });

  it("FALSE conta — \"não tem CNH\" é resposta, não lacuna", () => {
    expect(preenchido(false)).toBe(true);
  });

  it("objeto só conta se tiver algo dentro", () => {
    expect(preenchido({ nome: "", telefone: "" })).toBe(false);
    expect(preenchido({ nome: "Maria", telefone: "" })).toBe(true);
  });
});

describe("a porcentagem", () => {
  it("ficha cheia dá 100 e nada faltando", () => {
    const r = completudeDaFicha(cheia());
    expect(r.pct).toBe(100);
    expect(r.faltam).toEqual([]);
    expect(r.essenciaisOk).toBe(true);
  });

  it("ficha vazia dá 0", () => {
    expect(completudeDaFicha({}).pct).toBe(0);
  });

  it("essencial pesa mais que complementar", () => {
    const semCpf = { ...cheia(), cpf: "" };
    const semFoto = { ...cheia(), fotoDataUrl: "" };
    expect(completudeDaFicha(semCpf).pct).toBeLessThan(completudeDaFicha(semFoto).pct);
  });

  it("SEM CPF a cor é vermelha mesmo com % alta", () => {
    /* É o caso que motivou o peso: sem isto, 96% com CPF faltando apareceria
       verde e ninguém iria atrás. */
    const r = completudeDaFicha({ ...cheia(), cpf: "" });
    expect(r.pct).toBeGreaterThan(90);
    expect(r.faltamEssenciais).toBe(1);
    expect(tomDaCompletude(r)).toBe("ruim");
  });

  it("conta quantos essenciais faltam, não só se falta", () => {
    const r = completudeDaFicha({ ...cheia(), cpf: "", salario: 0, matriculaEsocial: "" });
    expect(r.faltamEssenciais).toBe(3);
  });

  it("diz QUAIS campos faltam, com o rótulo que a pessoa lê", () => {
    const r = completudeDaFicha({ ...cheia(), contatoEmergencia: null });
    expect(r.faltam.map((f) => f.rotulo)).toEqual(["Contato de emergência"]);
  });
});

describe("campos que só valem para alguns", () => {
  it("quem não tem filhos não é cobrado por filhos", () => {
    const semFilhos = { ...cheia(), qtdFilhos: 0, filhos: [] };
    expect(completudeDaFicha(semFilhos).faltam.map((f) => f.chave)).not.toContain("filhos");
    expect(completudeDaFicha(semFilhos).pct).toBe(100);
  });

  it("quem TEM filhos é cobrado", () => {
    const comFilhos = { ...cheia(), qtdFilhos: 2, filhos: [] };
    expect(completudeDaFicha(comFilhos).faltam.map((f) => f.chave)).toContain("filhos");
  });

  it("o total de campos contados muda com isso", () => {
    const sem = completudeDaFicha({ ...cheia(), qtdFilhos: 0 });
    const com = completudeDaFicha({ ...cheia(), qtdFilhos: 1 });
    expect(com.contados).toBe(sem.contados + 1);
  });
});

describe("a cor", () => {
  it("verde só com todos os essenciais e 90% ou mais", () => {
    expect(tomDaCompletude(completudeDaFicha(cheia()))).toBe("bom");
  });
  it("amarelo quando falta coisa, mas nada essencial", () => {
    const r = completudeDaFicha({ ...cheia(), email: "", telefone: "", enderecoRua: "", enderecoCep: "" });
    expect(r.essenciaisOk).toBe(true);
    expect(tomDaCompletude(r)).toBe("atencao");
  });
});
