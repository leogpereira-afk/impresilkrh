"use client";

import { Avatar } from "@/components/ui/misc";
import Link from "next/link";

export interface PontoNineBox {
  id: string;
  nome: string;
  potencial: string; // Baixo, Médio, Alto
  desempenho: string; // Baixo, Médio, Alto
}

const NIVEIS = ["Baixo", "Médio", "Alto"];

// Rótulos estratégicos de cada quadrante (linha = potencial desc, coluna = desempenho asc)
const ROTULOS: Record<string, { nome: string; cor: string }> = {
  "Alto-Baixo": { nome: "Enigma", cor: "#d97706" },
  "Alto-Médio": { nome: "Forte desempenho", cor: "#16a34a" },
  "Alto-Alto": { nome: "Estrela", cor: "#16a34a" },
  "Médio-Baixo": { nome: "Em observação", cor: "#d97706" },
  "Médio-Médio": { nome: "Mantenedor", cor: "#2563eb" },
  "Médio-Alto": { nome: "Alto desempenho", cor: "#16a34a" },
  "Baixo-Baixo": { nome: "Risco", cor: "#dc2626" },
  "Baixo-Médio": { nome: "Eficaz", cor: "#2563eb" },
  "Baixo-Alto": { nome: "Especialista", cor: "#2563eb" },
};

export function NineBox({ pontos }: { pontos: PontoNineBox[] }) {
  const celula = (pot: string, des: string) =>
    pontos.filter((p) => p.potencial === pot && p.desempenho === des);

  return (
    <div className="flex gap-3">
      {/* Eixo Y */}
      <div className="flex flex-col items-center justify-center">
        <span className="rotate-180 text-xs font-semibold uppercase tracking-wider text-slate-400 [writing-mode:vertical-rl]">
          Potencial →
        </span>
      </div>

      <div className="flex-1">
        <div className="grid grid-cols-3 gap-2">
          {[...NIVEIS].reverse().map((pot) =>
            NIVEIS.map((des) => {
              const itens = celula(pot, des);
              const rotulo = ROTULOS[`${pot}-${des}`];
              return (
                <div
                  key={`${pot}-${des}`}
                  className="min-h-[120px] rounded-xl border border-slate-200 p-2.5"
                  style={{ backgroundColor: rotulo.cor + "0d" }}
                >
                  <p
                    className="mb-2 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: rotulo.cor }}
                  >
                    {rotulo.nome}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {itens.map((p) => (
                      <Link key={p.id} href={`/colaboradores/${p.id}`} title={p.nome}>
                        <Avatar nome={p.nome} size="sm" />
                      </Link>
                    ))}
                  </div>
                </div>
              );
            }),
          )}
        </div>
        <p className="mt-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
          Desempenho →
        </p>
      </div>
    </div>
  );
}
