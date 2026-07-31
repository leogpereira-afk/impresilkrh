import { useState } from "react";
import { cn } from "@/lib/cn";

const chaveDe = (id: string) => `tabs:${id}`;

function lerSalva(chave: string | null, ids: string[], inicial?: string): string {
  if (chave && typeof sessionStorage !== "undefined") {
    try { const salvo = sessionStorage.getItem(chave); if (salvo && ids.includes(salvo)) return salvo; } catch { /* ignora */ }
  }
  return inicial ?? ids[0] ?? "";
}

/**
 * Aba ativa controlada por QUEM USA as abas, com a mesma persistência do <Tabs>.
 *
 * Serve para quando algo FORA da faixa de abas precisa mandar abrir uma delas —
 * o caso que motivou isto: os avisos de "Precisa de atenção" na ficha do
 * colaborador, em que clicar no aviso tem de pular para a aba onde se resolve o
 * problema (Férias, Documentos…). Sem isto o estado da aba morava dentro do
 * <Tabs> e ninguém de fora conseguia trocá-la.
 */
export function useAbaAtiva(idPersistencia: string, ids: string[], inicial?: string) {
  const chave = chaveDe(idPersistencia);
  const [ativa, setEstado] = useState(() => lerSalva(chave, ids, inicial));
  const definir = (id: string) => {
    setEstado(id);
    try { sessionStorage.setItem(chave, id); } catch { /* ignora */ }
  };
  return [ativa, definir] as const;
}

export function Tabs({
  abas,
  inicial,
  idPersistencia,
  ativa: ativaProp,
  aoMudar,
}: {
  abas: { id: string; label: string; icon?: React.ReactNode; conteudo: React.ReactNode }[];
  inicial?: string;
  // Quando definido, a aba ativa é lembrada (sessionStorage) entre remontagens —
  // ex.: navegar de um colaborador para outro mantém a mesma aba aberta.
  idPersistencia?: string;
  // Modo controlado: passe o par vindo de useAbaAtiva() para poder trocar a aba
  // de fora. Sem estes dois, o componente continua cuidando do estado sozinho.
  ativa?: string;
  aoMudar?: (id: string) => void;
}) {
  const chave = idPersistencia ? chaveDe(idPersistencia) : null;
  const controlado = ativaProp !== undefined;
  const [interna, setInterna] = useState(() => lerSalva(chave, abas.map((a) => a.id), inicial));
  const ativa = controlado ? ativaProp : interna;
  const mudar = (id: string) => {
    if (controlado) { aoMudar?.(id); return; } // no modo controlado quem persiste é o hook
    setInterna(id);
    if (chave) { try { sessionStorage.setItem(chave, id); } catch { /* ignora */ } }
    aoMudar?.(id);
  };
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
