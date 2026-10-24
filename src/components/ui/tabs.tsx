import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { IconeVolume } from "./icone-volume";

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
  navegacao = "abas",
}: {
  abas: { id: string; label: string; icon?: React.ReactNode; conteudo: React.ReactNode }[];
  navegacao?: "abas" | "seletor";
  inicial?: string;
  // Quando definido, a aba ativa é lembrada (sessionStorage) entre remontagens —
  // ex.: navegar de um colaborador para outro mantém a mesma aba aberta.
  idPersistencia?: string;
  // Modo controlado: passe o par vindo de useAbaAtiva() para poder trocar a aba
  // de fora. Sem estes dois, o componente continua cuidando do estado sozinho.
  ativa?: string;
  aoMudar?: (id: string) => void;
}) {
  const uid = useId();
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const chave = idPersistencia ? chaveDe(idPersistencia) : null;
  const controlado = ativaProp !== undefined;
  const [interna, setInterna] = useState(() => lerSalva(chave, abas.map((a) => a.id), inicial));
  const candidata = controlado ? ativaProp : interna;
  const ativa = abas.some(a => a.id === candidata) ? candidata : abas[0]?.id;
  const mudar = (id: string) => {
    if (controlado) { aoMudar?.(id); return; } // no modo controlado quem persiste é o hook
    setInterna(id);
    if (chave) { try { sessionStorage.setItem(chave, id); } catch { /* ignora */ } }
    aoMudar?.(id);
  };
  const atual = abas.find((a) => a.id === ativa) ?? abas[0];

  return (
    <div>
      {navegacao === "seletor" && <label className="mb-3 flex flex-wrap items-center gap-2 text-sm font-medium">Seção
        <select className="min-h-10 rounded-lg border border-slate-200 bg-white px-3" value={ativa} onChange={e => mudar(e.target.value)}>{abas.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
      </label>}
      <div role="tablist" aria-label="Seções desta tela" className={cn("rh-tabs mb-3 flex gap-1 overflow-x-auto border-b border-slate-200", navegacao === "seletor" && "hidden")}>
        {abas.map((a, indice) => {
          const ativo = a.id === ativa;
          return (
            <button
              key={a.id}
              type="button"
              role="tab"
              id={`${uid}-aba-${a.id}`}
              aria-selected={ativo}
              aria-controls={`${uid}-painel-${a.id}`}
              tabIndex={ativo ? 0 : -1}
              ref={el => { botoes.current[indice] = el; }}
              onKeyDown={e => {
                const proximo = e.key === 'ArrowRight' ? (indice + 1) % abas.length : e.key === 'ArrowLeft' ? (indice + abas.length - 1) % abas.length : e.key === 'Home' ? 0 : e.key === 'End' ? abas.length - 1 : null;
                if (proximo === null) return;
                e.preventDefault(); mudar(abas[proximo].id); botoes.current[proximo]?.focus();
              }}
              onClick={() => mudar(a.id)}
              className={cn(
                "relative flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors",
                ativo
                  ? "text-brand"
                  : "text-slate-500 hover:text-slate-800",
              )}
            >
              {a.icon && <IconeVolume pequeno>{a.icon}</IconeVolume>}
              {a.label}
              {ativo && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand" />
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${uid}-painel-${atual?.id}`} aria-labelledby={`${uid}-aba-${atual?.id}`} tabIndex={0} className="min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">{atual?.conteudo}</div>
    </div>
  );
}
