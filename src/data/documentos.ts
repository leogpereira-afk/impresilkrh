import type { Documento } from "./types";
import { COLABORADORES } from "./colaboradores";
import { mulberry32, HOJE, addDias } from "./_gen";

// Documentos por colaborador (Contrato, ASO, Exame Periódico) — alguns a vencer/vencidos
// para alimentar os alertas de conformidade (SST). Gerados de forma determinística.
const ativos = COLABORADORES.filter((c) => !c.ehDirecao && c.statusId !== "inativo");
const lista: Documento[] = [];

ativos.forEach((c, i) => {
  const rng = mulberry32(5000 + i * 131);
  const rint = (a: number, b: number) => Math.floor(rng() * (b - a + 1)) + a;

  lista.push({
    id: `doc-contrato-${c.id}`,
    colaboradorId: c.id,
    categoria: "Contrato",
    nome: "Contrato de Trabalho (CLT)",
    dataEmissao: c.dataAdmissao ?? null,
    enviadoPor: "RH",
    criadoEm: c.dataAdmissao ?? HOJE.toISOString(),
  });

  const venc = rng();
  const vencimentoASO =
    venc < 0.18 ? addDias(HOJE, -rint(1, 40)) : venc < 0.45 ? addDias(HOJE, rint(1, 55)) : addDias(HOJE, rint(120, 360));
  lista.push({
    id: `doc-aso-${c.id}`,
    colaboradorId: c.id,
    categoria: "ASO",
    nome: "Atestado de Saúde Ocupacional",
    dataEmissao: addDias(vencimentoASO, -365),
    dataVencimento: vencimentoASO,
    enviadoPor: "RH",
    criadoEm: HOJE.toISOString(),
  });

  if (rng() < 0.7) {
    const vencEx = rng() < 0.3 ? addDias(HOJE, rint(1, 50)) : addDias(HOJE, rint(90, 300));
    lista.push({
      id: `doc-exame-${c.id}`,
      colaboradorId: c.id,
      categoria: "Exame Periódico",
      nome: "Exame Periódico Ocupacional",
      dataEmissao: addDias(vencEx, -180),
      dataVencimento: vencEx,
      enviadoPor: "RH",
      criadoEm: HOJE.toISOString(),
    });
  }
});

export const DOCUMENTOS: Documento[] = lista;
