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
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useState, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Modal } from "./modal";

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
});
