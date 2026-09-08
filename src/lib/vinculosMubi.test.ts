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

describe("conferir é uma AÇÃO, não só um aviso", () => {
  /* O painel dizia "10 para conferir" e o único botão era "Apagar" — que é
     destrutivo e nem resolve: o vínculo volta na importação seguinte. Quem
     olhava um vínculo CERTO ("CANDIDA" → Candida Eliza David Barros) não tinha
     como dizer que está certo, e o aviso ficava para sempre. */
  it("o vínculo conferido para de acusar", () => {
    const vinculos = { "PEDRO HENRIQUE GONCALVES PEREI": "pedro-henrique" };
    expect(conferirVinculos(vinculos, CADASTRO)[0].alerta).toBe("nome-diferente");
    const v = conferirVinculos(vinculos, CADASTRO, { "PEDRO HENRIQUE GONCALVES PEREI": "pedro-henrique" })[0];
    expect(v.alerta).toBeNull();
    expect(v.conferido).toBe(true);
  });

  it("conferir vale para o PAR nome→ficha: reapontar traz o aviso de volta", () => {
    // Senão um "conferi" de hoje calaria para sempre um vínculo que amanhã
    // aponta para outra pessoa — o defeito que este painel existe para pegar.
    const conferidos = { "PEDRO HENRIQUE SANTOS OLIVEIRA": "pedro-henrique" };
    expect(conferirVinculos({ "PEDRO HENRIQUE SANTOS OLIVEIRA": "pedro-henrique" }, CADASTRO, conferidos)[0].alerta).toBeNull();
    // agora aponta para OUTRA ficha: o conferido não vale mais
    const v = conferirVinculos({ "PEDRO HENRIQUE SANTOS OLIVEIRA": "lucas-natalino" }, CADASTRO, conferidos)[0];
    expect(v.conferido).toBe(false);
    expect(v.alerta).toBe("nome-diferente");
  });

  it("“ficha não existe” NÃO se cala com um conferi — é fato, não opinião", () => {
    const conferidos = { "FULANO": "ficha-apagada" };
    const v = conferirVinculos({ "FULANO": "ficha-apagada" }, CADASTRO, conferidos)[0];
    expect(v.alerta).toBe("sem-ficha");
    expect(v.conferido).toBe(false);
  });

  it("oferece a alternativa: quem a régua automática acharia para este nome", () => {
    // É o que faltava para poder NEGAR sem apagar às cegas.
    const v = conferirVinculos({ "LUCAS NATALINO FERREIRA SILVA": "pedro-ramos" }, CADASTRO)[0];
    expect(v.alerta).toBe("nome-diferente");
    expect(v.sugestao?.id).toBe("lucas-natalino");
  });

  it("quando a régua concorda com o vínculo, não há alternativa a oferecer", () => {
    const v = conferirVinculos({ "LUCAS NATALINO FERREIRA SILVA": "lucas-natalino" }, CADASTRO)[0];
    expect(v.alerta).toBeNull();
    expect(v.sugestao).toBeNull();
  });

  it("nome que a régua não acha ninguém não inventa alternativa", () => {
    const v = conferirVinculos({ "NINGUEM COM ESSE NOME AQUI": "pedro-ramos" }, CADASTRO)[0];
    expect(v.sugestao).toBeNull();
  });

  it("sem o mapa de conferidos, nada muda (compatível com o que já estava salvo)", () => {
    const vinculos = { "PEDRO HENRIQUE SANTOS OLIVEIRA": "pedro-henrique" };
    expect(conferirVinculos(vinculos, CADASTRO)).toEqual(conferirVinculos(vinculos, CADASTRO, {}));
  });
});
