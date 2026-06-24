import { useState } from "react";
import { cn } from "@/lib/cn";

export function Tabs({
  abas,
  inicial,
  idPersistencia,
}: {
  abas: { id: string; label: string; icon?: React.ReactNode; conteudo: React.ReactNode }[];
  inicial?: string;
  // Quando definido, a aba ativa é lembrada (sessionStorage) entre remontagens —
  // ex.: navegar de um colaborador para outro mantém a mesma aba aberta.
  idPersistencia?: string;
}) {
  const chave = idPersistencia ? `tabs:${idPersistencia}` : null;
  const [ativa, setAtiva] = useState(() => {
    if (chave && typeof sessionStorage !== "undefined") {
      try { const salvo = sessionStorage.getItem(chave); if (salvo && abas.some((a) => a.id === salvo)) return salvo; } catch { /* ignora */ }
    }
    return inicial ?? abas[0]?.id;
  });
  const mudar = (id: string) => { setAtiva(id); if (chave) { try { sessionStorage.setItem(chave, id); } catch { /* ignora */ } } };
  const atual = abas.find((a) => a.id === ativa) ?? abas[0];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {abas.map((a) => {
          const ativo = a.id === ativa;
          return (
            <button
              key={a.id}
              onClick={() => mudar(a.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
                ativo
                  ? "text-brand"
                  : "text-slate-500 hover:text-slate-800",
              )}
            >
              {a.icon}
              {a.label}
              {ativo && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />
              )}
            </button>
          );
        })}
      </div>
      <div>{atual?.conteudo}</div>
    </div>
  );
}
