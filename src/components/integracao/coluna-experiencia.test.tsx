/* A coluna "Termina em" da listagem de quem está em contrato de experiência.
 *
 * Começa pelos dois casos ruins, que são os que só aparecem no dia ruim:
 * prazo já vencido (não pode virar "faltam -5 dias", porque o sinal de menos
 * passa batido numa linha de tabela e o urgente fica com a cara do tranquilo)
 * e pessoa que a busca não achou -- a coluna recebe Colaborador cru do
 * DrillModal e tem de procurar, então "não achei" é um desfecho real.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ColunaFimExperiencia } from "./coluna-experiencia";
import type { PessoaEmExperiencia } from "@/lib/emExperiencia";
import type { Colaborador } from "@/data/types";

// React 18 exige esta marca para não avisar a cada act().
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

/** Desenha a coluna e devolve o <span> que ela produziu (ou o container). */
function desenhar(pessoa?: PessoaEmExperiencia) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<ColunaFimExperiencia pessoa={pessoa} />));
  return { texto: host.textContent ?? "", classe: host.querySelector("span")?.className ?? "" };
}

/* `fim` ao MEIO-DIA local, como `parseData` ancora. Meia-noite UTC exibiria a
   véspera aqui (UTC-3) e o teste passaria a medir o fuso, não a coluna. */
const pessoa = (fim: string, diasParaFim: number): PessoaEmExperiencia => ({
  c: { id: "x", nome: "Fulano" } as Colaborador,
  sit: {
    diasDeCasa: 90 - diasParaFim,
    fim: new Date(fim),
    diasParaFim,
    situacao: diasParaFim < 0 ? "expirou" : "primeiro-periodo",
  },
  marcado: true,
});

describe("os casos ruins", () => {
  it("prazo vencido NÃO vira 'faltam -5 dias'", () => {
    const r = desenhar(pessoa("2026-09-18T12:00", -5));
    expect(r.texto).toContain("venceu há 5 dia");
    expect(r.texto).not.toContain("-5");
    // E em vermelho: é o caso em que o contrato já virou indeterminado sozinho.
    expect(r.classe).toContain("text-red-600");
  });

  it("sem pessoa mostra um traço: não quebra e não inventa data", () => {
    expect(desenhar(undefined).texto).toBe("—");
  });
});

describe("o dia e quanto falta", () => {
  it("mostra a data em formato brasileiro e os dias que faltam", () => {
    const r = desenhar(pessoa("2026-11-30T12:00", 68));
    expect(r.texto).toContain("30/11/2026");
    expect(r.texto).toContain("faltam 68 dia");
  });

  it("vencendo hoje é dito com todas as letras, não '0 dias'", () => {
    const r = desenhar(pessoa("2026-09-23T12:00", 0));
    expect(r.texto).toContain("é hoje");
    expect(r.texto).not.toContain("0 dia");
  });

  it("a menos de duas semanas fica em âmbar; com folga, em cinza", () => {
    // A cor é o aviso lido de longe. Se os três estados saíssem iguais, a
    // coluna viraria decoração e ninguém repararia.
    expect(desenhar(pessoa("2026-10-01T12:00", 8)).classe).toContain("text-amber-700");
    expect(desenhar(pessoa("2026-11-30T12:00", 68)).classe).toContain("text-slate-600");
  });
});
