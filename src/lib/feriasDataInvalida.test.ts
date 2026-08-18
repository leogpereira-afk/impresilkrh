/* ANO DE CINCO DÍGITOS — o erro de dedo que passava por todas as travas.
 *
 * O campo de data do navegador (<input type="date">) ACEITA ano de cinco
 * dígitos: digitar 20266 no lugar de 2026 deixa o campo com "20266-05-31", e
 * está conferido em navegador de verdade que ele não recusa. `new Date` devolve
 * para isso um "Invalid Date" — e Invalid Date é TRUTHY.
 *
 * Daí saíam três consequências, todas caladas:
 *
 *   1. `if (data)` passava, porque o objeto existe;
 *   2. toda comparação com ele é NaN, e NaN não é maior nem menor que nada —
 *      então "retorno antes do início" e "mais de 30 dias" não pegavam;
 *   3. `.toISOString()` de um Invalid Date lança RangeError. Na tela de Férias
 *      essa chamada acontece durante o DESENHO, na linha que escreve "Fica fora
 *      de … a …". Erro no meio do desenho derruba a tela inteira: quem estava
 *      preenchendo perdia tudo, sem mensagem.
 *
 * Havia uma sondagem antiga sobre isso commitada em src/lib/__probe_ano5.test.ts,
 * que só imprimia no console e terminava em `expect(true).toBe(true)` — ela
 * contava como "mais um teste passando" sem afirmar nada. Este arquivo a
 * substitui pelo que ela deveria ter sido.
 */
import { describe, it, expect } from "vitest";
import { validarAgendamento, validarPeriodo, temErro } from "./feriasAgenda";

/** O que o campo de data entrega quando o dedo escorrega no ano. */
const CINCO_DIGITOS = new Date("20266-05-31T12:00:00");
const NORMAL = new Date("2026-05-31T12:00:00");
const RETORNO_OK = new Date("2026-06-29T12:00:00");

describe("data inválida vinda do campo", () => {
  it("Invalid Date é truthy — a premissa que quebrava as guardas", () => {
    expect(!!CINCO_DIGITOS).toBe(true);
    expect(isNaN(CINCO_DIGITOS.getTime())).toBe(true);
    // E é por isso que nenhuma comparação segura nada:
    expect(NaN > 30).toBe(false);
    expect(NaN <= 0).toBe(false);
  });

  it("agendar com ano de 5 dígitos trava, e a mensagem fala do ano", () => {
    const a = validarAgendamento({ inicio: CINCO_DIGITOS, dias: 30 });
    expect(temErro(a)).toBe(true);
    // Não pode dizer "escolha a data": para quem preencheu, ela ESTÁ escolhida.
    // A mensagem tem de apontar o ano, que é onde está o erro.
    expect(a[0].texto.toLowerCase()).toContain("ano");
  });

  it("campo vazio continua com a mensagem de campo vazio", () => {
    // O conserto não pode transformar "faltou preencher" em "está inválido":
    // são situações diferentes e a pessoa resolve cada uma de um jeito.
    const a = validarAgendamento({ inicio: null, dias: 30 });
    expect(temErro(a)).toBe(true);
    expect(a[0].texto.toLowerCase()).not.toContain("ano");
  });

  it("editar período com data inválida trava (antes passava calado)", () => {
    const a = validarPeriodo(CINCO_DIGITOS, RETORNO_OK);
    expect(temErro(a)).toBe(true);
    expect(a[0].texto.toLowerCase()).toContain("ano");
  });

  it("o retorno inválido também trava", () => {
    const a = validarPeriodo(NORMAL, new Date("20266-06-29T12:00:00"));
    expect(temErro(a)).toBe(true);
  });

  it("período normal continua passando", () => {
    // A trava nova não pode reprovar quem digitou certo.
    expect(temErro(validarPeriodo(NORMAL, RETORNO_OK))).toBe(false);
    expect(temErro(validarAgendamento({ inicio: NORMAL, dias: 30 }))).toBe(false);
  });

  it("as duas datas em branco seguem sendo período em aberto, sem erro", () => {
    expect(validarPeriodo(null, null)).toEqual([]);
  });
});
