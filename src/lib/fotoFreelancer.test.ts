import { describe, expect, it } from "vitest";
import { origemFotoFreelancer } from "./fotoFreelancer";

const f = { id: "contrato", cpf: "90000100129", fotoDataUrl: "foto-contrato" };
const c = { id: "ficha", cpf: "900.001.001-29", fotoDataUrl: "foto-ficha" };

describe("foto compartilhada do freelancer", () => {
  it("lê e edita a ficha ligada pelo CPF, sem copiar a foto", () => {
    expect(origemFotoFreelancer(f, [c])).toEqual({ ambiguo: false, colecao: "colaboradores", id: "ficha", foto: "foto-ficha" });
    expect(origemFotoFreelancer(f, [{ ...c, fotoDataUrl: null }]).foto).toBeNull();
    expect(origemFotoFreelancer(f, [{ ...c, fotoDataUrl: "nova" }]).foto).toBe("nova");
  });
  it("sem ficha, grava a foto no contrato", () => {
    expect(origemFotoFreelancer(f, [])).toEqual({ ambiguo: false, colecao: "freelancers", id: "contrato", foto: "foto-contrato" });
  });
  it("vínculo explícito vale se falta CPF, mas não ignora CPFs divergentes", () => {
    expect(origemFotoFreelancer({ ...f, cpf: "", exColaboradorId: "ficha" }, [c]).id).toBe("ficha");
    expect(origemFotoFreelancer({ ...f, cpf: "90000200263", exColaboradorId: "ficha" }, [c]).colecao).toBe("freelancers");
  });
  it("não escolhe entre fichas duplicadas nem usa ID curto como CPF", () => {
    expect(origemFotoFreelancer(f, [c, { ...c, id: "outra" }])).toMatchObject({ ambiguo: true, foto: null });
    expect(origemFotoFreelancer({ ...f, cpf: "900001" }, [{ ...c, cpf: "900001" }]).colecao).toBe("freelancers");
  });
});
