import { describe, expect, it } from "vitest";
import { conferirVinculos } from "./vinculosMubi";
import type { Colaborador } from "@/data/types";

const c = (id: string, nome: string, cpf?: string) => ({ id, nome, cpf } as unknown as Colaborador);
const CADASTRO = [
  c("pedro-henrique", "Pedro Henrique Golçalves Pereira", "111.508.536-03"),
  c("lucas-natalino", "Lucas Natalino Ferreira Silva", "116.282.336-08"),
  c("pedro-ramos", "Pedro Ramos"),
];

describe("conferir vínculos guardados", () => {
  it("nome do ERP que não é o da ficha vira aviso — foi o caso real do Léo", () => {
    // O ERP corta o nome em 30 letras: os dois começam iguais e são pessoas
    // diferentes. "PEDRO HENRIQUE SANTOS OLIVEIRA" não existe na Impresilk.
    const v = conferirVinculos({ "PEDRO HENRIQUE SANTOS OLIVEIRA": "pedro-henrique" }, CADASTRO);
    expect(v[0].alerta).toBe("nome-diferente");
  });

  it("o nome truncado da própria pessoa não vira aviso", () => {
    const semErro = [c("ph", "Pedro Henrique Gonçalves Pereira", "111.508.536-03")];
    expect(conferirVinculos({ "PEDRO HENRIQUE GONCALVES PEREI": "ph" }, semErro)[0].alerta).toBeNull();
  });

  it("erro de digitação no cadastro TAMBÉM é acusado — e o conserto é o cadastro", () => {
    // A ficha real diz "Golçalves" (com L); o ERP manda "GONCALVES". O sistema
    // não adivinha erro de digitação (decisão do Léo), então o vínculo existe
    // justamente por causa disso — e o aviso lembra de arrumar o nome.
    const v = conferirVinculos({ "PEDRO HENRIQUE GONCALVES PEREI": "pedro-henrique" }, CADASTRO);
    expect(v[0].alerta).toBe("nome-diferente");
  });

  it("primeiro nome sozinho continua valendo (cadastro abreviado é rotina)", () => {
    expect(conferirVinculos({ "LUCAS NATALINO": "lucas-natalino" }, CADASTRO)[0].alerta).toBeNull();
  });

  it("dois nomes de gente diferente com o mesmo primeiro nome viram aviso", () => {
    expect(conferirVinculos({ "LUCAS GABRIEL LEITE SOARES": "lucas-natalino" }, CADASTRO)[0].alerta).toBe("nome-diferente");
  });

  it("leva do ERP não é pessoa", () => {
    expect(conferirVinculos({ COLABORADORES: "pedro-ramos" }, CADASTRO)[0].alerta).toBe("generico");
  });

  it("ficha apagada é acusada, e não quebra", () => {
    const v = conferirVinculos({ "FULANO DE TAL": "sumiu" }, CADASTRO);
    expect(v[0].alerta).toBe("sem-ficha");
    expect(v[0].ficha).toBeNull();
  });

  it("os que pedem conferência vêm primeiro", () => {
    const v = conferirVinculos({ "LUCAS NATALINO": "lucas-natalino", COLABORADORES: "pedro-ramos" }, CADASTRO);
    expect(v.map((x: { chave: string }) => x.chave)).toEqual(["COLABORADORES", "LUCAS NATALINO"]);
  });
});
