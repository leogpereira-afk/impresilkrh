/* O MODAL NÃO PODE ROUBAR O FOCO DE QUEM ESTÁ DIGITANDO.
 *
 * O defeito que motivou este teste, relatado do chão de fábrica como "trava, e
 * quando clico numa coisa vai para outra": o efeito que dá o foco inicial tinha
 * `onFechar` na lista de dependências. Como 90 das 132 chamadas de <Modal> no
 * sistema passam uma função escrita na hora (`onFechar={() => ...}`), a função
 * nasce diferente a cada desenho — e o React entendia "dependência mudou, roda
 * de novo". Resultado: a cada LETRA digitada o efeito rodava outra vez e jogava
 * o foco no primeiro item do modal (o "X" de fechar).
 *
 * Quem estava preenchendo digitava uma letra e o cursor sumia do campo. Pior:
 * com o foco no "X", um espaço ou um Enter FECHAVA o modal e perdia o
 * preenchimento.
 *
 * Em jsdom não há layout, então `offsetParent` é sempre nulo e a lista de
 * focáveis sai vazia — o foco roubado cai no próprio diálogo em vez do "X". O
 * que este teste afirma é o que importa nos dois casos: depois de redesenhar,
 * o foco continua onde a pessoa o deixou.
 */
import { describe, it, expect, beforeEach, beforeAll, afterEach } from "vitest";
import { useState, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Modal } from "./modal";

/* O Modal decide o que é focável olhando `offsetParent` — o jeito clássico de
   perguntar "isto está visível na tela?". O jsdom não calcula layout e devolve
   nulo SEMPRE, então sem este remendo a lista de focáveis sairia vazia e os
   testes de foco passariam sem provar nada: o foco cairia no diálogo por falta
   de candidatos, e não porque o código escolheu certo. Aqui `offsetParent`
   responde como num navegador — nulo só para quem está escondido. */
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get(this: HTMLElement) {
      return this.style.display === "none" ? null : this.parentElement;
    },
  });
});

// React 18 exige esta marca para não avisar a cada act().
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Reproduz a "Nova viagem": estado no pai e onFechar escrito na hora. */
function Formulario() {
  const [texto, setTexto] = useState("");
  return (
    <Modal aberto onFechar={() => {}} titulo="Nova viagem">
      <input
        data-testid="destino"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
    </Modal>
  );
}

/** Digita de verdade: mexe no valor e dispara o evento que o React escuta. */
function digitar(campo: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  setter.call(campo, valor);
  campo.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("Modal — foco", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("mantém o foco no campo enquanto a pessoa digita", () => {
    act(() => {
      root = createRoot(container);
      root.render(<Formulario />);
    });

    const destino = document.querySelector<HTMLInputElement>('[data-testid="destino"]')!;
    act(() => destino.focus());
    expect(document.activeElement).toBe(destino);

    // Uma letra basta: ela redesenha o componente e recria o onFechar.
    act(() => digitar(destino, "N"));
    expect(document.activeElement).toBe(destino);

    // E continua valendo depois da segunda — o defeito reaparecia a cada tecla.
    act(() => digitar(destino, "Na"));
    expect(document.activeElement).toBe(destino);
    expect(destino.value).toBe("Na");
  });

  it("ainda dá o foco inicial ao abrir", () => {
    // O conserto não pode custar a acessibilidade: quem abre o modal pelo
    // teclado precisa continuar caindo dentro dele, e não atrás dele.
    const fora = document.createElement("button");
    document.body.appendChild(fora);
    fora.focus();

    act(() => {
      root = createRoot(container);
      root.render(<Formulario />);
    });

    expect(document.activeElement).not.toBe(fora);
    expect(container.ownerDocument.activeElement?.closest('[role="dialog"]')).toBeTruthy();
    fora.remove();
  });

  it("não põe o foco inicial no X de fechar", () => {
    /* O "X" é o primeiro focável do diálogo porque vem antes de tudo no HTML.
       Deixar o foco nele fazia abrir o modal e digitar não escrever nada — e a
       primeira tecla, sendo espaço ou Enter, FECHAVA o modal com tudo dentro. */
    act(() => {
      root = createRoot(container);
      root.render(<Formulario />);
    });
    const fechar = document.querySelector<HTMLElement>('[aria-label="Fechar"]')!;
    expect(fechar).toBeTruthy(); // o botão existe, então o teste tem sentido
    expect(document.activeElement).not.toBe(fechar);
  });

  it("respeita o autoFocus de quem escreveu a tela", () => {
    function ComAutoFocus() {
      return (
        <Modal aberto onFechar={() => {}} titulo="Nova vaga">
          <input data-testid="a" />
          <input data-testid="titulo" autoFocus />
        </Modal>
      );
    }
    act(() => {
      root = createRoot(container);
      root.render(<ComAutoFocus />);
    });
    // Não é o primeiro campo do corpo: é o que a tela pediu.
    expect(document.activeElement).toBe(document.querySelector('[data-testid="titulo"]'));
  });
});

describe("Modal — modal sobre modal", () => {
  let container: HTMLDivElement;
  let root: Root;

  /* O caso real: a prévia da sincronização (a tela mais destrutiva do sistema,
     que avisa quantos registros somem da nuvem) abre POR CIMA do painel de
     Sincronização. Antes, os dois ouviam a mesma tecla. */
  function Empilhados({ deCima }: { deCima: boolean }) {
    const [fechouDeBaixo, setFechouDeBaixo] = useState(false);
    return (
      <>
        <Modal aberto={!fechouDeBaixo} onFechar={() => setFechouDeBaixo(true)} titulo="Sincronização">
          <input data-testid="fundo" />
        </Modal>
        {deCima && (
          <Modal aberto onFechar={() => {}} titulo="Prévia">
            <input data-testid="topo" />
          </Modal>
        )}
        <span data-testid="estado">{fechouDeBaixo ? "fechado" : "aberto"}</span>
      </>
    );
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("Escape no de cima não fecha o de baixo", () => {
    act(() => {
      root = createRoot(container);
      root.render(<Empilhados deCima />);
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    // O de baixo continua aberto: quem responde é só o modal do topo.
    expect(document.querySelector('[data-testid="estado"]')?.textContent).toBe("aberto");
  });

  it("fechar o de cima não devolve a rolagem enquanto o de baixo está aberto", () => {
    act(() => {
      root = createRoot(container);
      root.render(<Empilhados deCima />);
    });
    expect(document.body.style.overflow).toBe("hidden");
    act(() => root.render(<Empilhados deCima={false} />));
    // Ainda há um modal aberto — a página de trás não pode voltar a rolar.
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("com todos fechados, a rolagem volta", () => {
    act(() => {
      root = createRoot(container);
      root.render(<Empilhados deCima />);
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    act(() => root.render(<Empilhados deCima={false} />));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.body.style.overflow).toBe("");
  });
});
