/* A tela da conferência com o Mubisys (22/09/2026).
 *
 * A tela de Cadastros exige login, então não dá para eu clicar nela. Isto é a
 * prova que sobra: renderizar o componente de verdade, com o texto REAL
 * copiado da tela do ERP, e olhar o que saiu.
 *
 * Começa pelo caso ruim: uma tela que mostra divergência sem dizer que o
 * casamento foi por palpite — quem lê aplicaria o valor na pessoa errada.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ConferenciaMubi } from "./conferencia-mubi";
import type { CampoConferido, FichaRh } from "@/lib/conferenciaMubiRh";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const COLADO = `Adilson Barbosa Fonseca 083.421.036-33 13/01/2014 Atendente extreno +55 (38) 9940-7547 R$ 1.955,43 R$ 1.996,37 Produção
Demerval Vieira 965640246-9 20/01/2026 Designer +55 (38) 99107-5055 R$ 2.140,00 R$ 2.097,53 Produção
Victor Douglas Lopes Siqueira 159.382.836-55 02/03/2026 Operador de Comunicação Visual +55 (38) 99872-0852 R$ 1.872,50 R$ 1.878,46 Produção`;

const FICHAS: FichaRh[] = [
  { id: "adilson", nome: "Adilson Barbosa Fonseca", cpf: "08342103633", dataAdmissao: "2014-01-13", telefone: "(38) 99940-7547" },
  { id: "victor", nome: "Victor Douglas Lopes Siqueira", cpf: "15938283655", dataAdmissao: "2026-08-10" },
  { id: "dermeval", nome: "Demerval Vieira", cpf: "21378946960", dataAdmissao: "2026-01-20" },
  { id: "osmane", nome: "Osmane Vinicius Nepomuceno Oliveira", cpf: "12986531695" },
];

describe("ConferenciaMubi", () => {
  let container: HTMLDivElement;
  let root: Root;
  const aplicados: { id: string; campo: CampoConferido; valor: string }[] = [];

  const desenhar = (texto: string) => {
    act(() => {
      root.render(
        <ConferenciaMubi
          fichas={FICHAS}
          onAplicar={(id, campo, valor) => aplicados.push({ id, campo, valor })}
        />,
      );
    });
    if (texto) {
      const area = container.querySelector("textarea")!;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      act(() => {
        setter.call(area, texto);
        area.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
  };
  /* O texto do RESULTADO, sem o textarea.
     Ler `container.textContent` inteiro acusava o nome que está no texto
     COLADO — asserção larga demais, que passava e falhava por motivo errado.
     É a mesma armadilha que me pegou hoje cedo procurando "3200" e achando o
     CEP 32000-000. */
  const texto = () => {
    const copia = container.cloneNode(true) as HTMLElement;
    copia.querySelectorAll("textarea").forEach((t) => t.remove());
    return copia.textContent ?? "";
  };

  beforeEach(() => {
    aplicados.length = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("O CASO RUIM: o casamento por NOME é declarado — senão aplica na pessoa errada", () => {
    // O Dermeval tem um CPF em cada sistema. A tela não pode apresentar isso
    // como se fosse certeza: quem lê precisa saber que o documento não casou.
    desenhar(COLADO);
    expect(texto()).toContain("ligado pelo nome — o CPF não casou");
  });

  it("sem nada colado, diz isso — não finge conferência feita", () => {
    desenhar("");
    expect(texto()).toContain("Nada colado ainda.");
    expect(texto()).not.toContain("Nenhuma divergência");
  });

  it("mostra os DOIS lados de cada divergência, sem eleger vencedor", () => {
    desenhar(COLADO);
    expect(texto()).toContain("Admissão");
    expect(texto()).toContain("2026-08-10"); // o que o RH tem
    expect(texto()).toContain("2026-03-02"); // o que o Mubisys tem
  });

  it("quem bate NÃO aparece na lista de divergências", () => {
    desenhar(COLADO);
    // Adilson confere nos dois sistemas: não pode virar linha para conferir.
    expect(texto()).not.toContain("Adilson Barbosa Fonseca");
    // E os que discordam aparecem — senão este teste passaria com a tela vazia.
    expect(texto()).toContain("Victor Douglas Lopes Siqueira");
    expect(texto()).toContain("Demerval Vieira");
  });

  it("o botão aplica UM campo de UMA pessoa, com o valor do ERP", () => {
    desenhar(COLADO);
    const botoes = [...container.querySelectorAll("button")].filter((b) => /(usar|preencher) (o )?com o do Mubisys|usar o do Mubisys/.test(b.textContent ?? ""));
    expect(botoes.length).toBeGreaterThan(0);
    act(() => botoes[0].dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(aplicados).toHaveLength(1);
    expect(aplicados[0].valor).toBeTruthy();
  });

  it("quem só existe de um lado aparece, com o motivo explicado", () => {
    desenhar(COLADO);
    expect(texto()).toContain("Só no RH");
    expect(texto()).toContain("Osmane");
    expect(texto()).toContain("Gente na folha do ERP que o RH não conhece");
  });

  it("bloco vazio DIZ que está vazio — sumir faria 'sem divergência' e 'não conferi' virarem a mesma coisa", () => {
    desenhar(COLADO);
    expect(texto()).toContain("Ninguém — todo o quadro do ERP está no RH.");
  });

  it("linha que não deu para ler aparece em destaque, com o texto original", () => {
    desenhar(COLADO + "\nFulano De Tal veio sem documento");
    expect(texto()).toContain("linha(s) que eu não entendi");
    expect(texto()).toContain("Fulano De Tal veio sem documento");
  });

  it("o resumo conta antes de qualquer lista", () => {
    desenhar(COLADO);
    expect(texto()).toMatch(/3 conferido\(s\)/);
    expect(texto()).toMatch(/faltando no RH/);
    expect(texto()).toMatch(/em que discordam/);
  });

  it("O CASO RUIM: admissão aparece SEM botão, com o motivo escrito", () => {
    // O Léo decidiu não mexer (22/09). A diferença de cinco meses continua na
    // tela — esconder seria pior —, mas sem oferta de gravar.
    desenhar(COLADO);
    expect(texto()).toContain("a admissão fica como está");
    const linhas = [...container.querySelectorAll("tr")].filter((tr) => /Admissão/.test(tr.textContent ?? ""));
    expect(linhas.length).toBeGreaterThan(0);
    for (const tr of linhas) expect(tr.querySelector("button")).toBeNull();
  });

  it("O CASO RUIM: CPF quebrado do ERP não ganha botão de aplicar", () => {
    desenhar(COLADO);
    expect(texto()).toContain("10 dígitos");
    const linhas = [...container.querySelectorAll("tr")].filter((tr) => /CPF/.test(tr.textContent ?? ""));
    for (const tr of linhas) expect(tr.querySelector("button")).toBeNull();
  });

  it("campo que falta no RH é marcado como falta, e o botão diz 'preencher'", () => {
    desenhar(COLADO);
    expect(texto()).toContain("falta no RH");
    const preencher = [...container.querySelectorAll("button")].filter((b) => /preencher com o do Mubisys/.test(b.textContent ?? ""));
    expect(preencher.length).toBeGreaterThan(0);
  });
});
