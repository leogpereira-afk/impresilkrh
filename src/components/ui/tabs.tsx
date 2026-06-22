import { useState } from "react";
import { cn } from "@/lib/cn";

export function Tabs({
  abas,
  inicial,
}: {
  abas: { id: string; label: string; icon?: React.ReactNode; conteudo: React.ReactNode }[];
  inicial?: string;
}) {
  const [ativa, setAtiva] = useState(inicial ?? abas[0]?.id);
  const atual = abas.find((a) => a.id === ativa) ?? abas[0];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {abas.map((a) => {
          const ativo = a.id === ativa;
          return (
            <button
              key={a.id}
              onClick={() => setAtiva(a.id)}
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
