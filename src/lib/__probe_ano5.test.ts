import { describe, it, expect } from "vitest";
import { validarPeriodo, temErro, diasEntre } from "./feriasAgenda";

const inputParaIso = (v: string) => (v ? new Date(`${v}T12:00:00`).toISOString() : null);

describe("probe ano de 5 digitos", () => {
  it("validarPeriodo com Invalid Date", () => {
    const edInicio = new Date("20266-05-31T12:00:00");
    const edRetorno = new Date("2026-09-03T12:00:00");
    console.log("TZ:", Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log("edInicio truthy?", !!edInicio, "| isNaN:", isNaN(edInicio.getTime()));
    console.log("diasEntre:", diasEntre(edInicio, edRetorno));
    const a = validarPeriodo(edInicio, edRetorno);
    console.log("achados:", JSON.stringify(a), "| temErro:", temErro(a));
    let r = "sem erro";
    try { inputParaIso("20266-05-31"); } catch (e: any) { r = e.constructor.name + ": " + e.message; }
    console.log("inputParaIso('20266-05-31') =>", r);
    expect(true).toBe(true);
  });
});
