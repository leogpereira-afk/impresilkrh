import { useState } from "react";
import { Link } from "react-router-dom";
import { Users, ChevronRight } from "lucide-react";
import { Modal } from "./modal";
import { Avatar, EmptyState } from "./misc";
import { DotBadge } from "./badge";
import { HumorIndicador } from "./indicadores";
import { useDominio } from "@/lib/dominio";
import { formatDate } from "@/lib/format";
import type { Colaborador } from "@/data/types";

// Drill-down: torna gráficos/indicadores clicáveis. Ao clicar, abre uma listagem
// analítica com os NOMES dos colaboradores que compõem aquela métrica.
export function useDrill() {
  const [estado, setEstado] = useState<{ titulo: string; subtitulo?: string; lista: Colaborador[] } | null>(null);
  return {
    abrir: (titulo: string, lista: Colaborador[], subtitulo?: string) => setEstado({ titulo, subtitulo, lista }),
    fechar: () => setEstado(null),
    props: {
      aberto: !!estado,
      titulo: estado?.titulo ?? "",
      subtitulo: estado?.subtitulo,
      colaboradores: estado?.lista ?? [],
      onFechar: () => setEstado(null),
    },
  };
}

export function DrillModal({
  aberto,
  onFechar,
  titulo,
  subtitulo,
  colaboradores,
  colunaExtra,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  subtitulo?: string;
  colaboradores: Colaborador[];
  colunaExtra?: { titulo: string; render: (c: Colaborador) => React.ReactNode };
}) {
  const d = useDominio();
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo={titulo} descricao={subtitulo ?? `${colaboradores.length} colaborador(es)`} largura="max-w-3xl">
      {colaboradores.length === 0 ? (
        <EmptyState title="Nenhum colaborador" icon={<Users className="h-8 w-8" />} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100">
              <tr>
                <th className="th">Colaborador</th>
                <th className="th hidden sm:table-cell">Cargo</th>
                <th className="th hidden md:table-cell">Admissão</th>
                <th className="th">{colunaExtra?.titulo ?? "Status"}</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {colaboradores.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="td">
                    <Link to={`/colaboradores/${c.id}`} onClick={onFechar} className="flex items-center gap-2.5">
                      <Avatar nome={c.nome} size="sm" />
                      <span className="font-medium text-slate-800">{c.nome}</span>
                    </Link>
                  </td>
                  <td className="td hidden sm:table-cell text-slate-500">{d.nomeCargo(c)}</td>
                  <td className="td hidden md:table-cell text-slate-500">{formatDate(c.dataAdmissao)}</td>
                  <td className="td">
                    {colunaExtra ? colunaExtra.render(c) : <DotBadge label={d.nomeStatus(c.statusId)} cor={d.corStatus(c.statusId)} />}
                  </td>
                  <td className="td text-right">
                    <Link to={`/colaboradores/${c.id}`} onClick={onFechar} className="inline-flex text-slate-300 hover:text-brand">
                      <ChevronRight className="h-5 w-5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
