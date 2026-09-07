import { useMemo, useRef } from "react";
import { cn } from "@/lib/cn";
import { MESES_PT } from "@/lib/format";
import { Select } from "@/components/ui/form";

export interface InfoMes {
  /** Tem folha (pagamentos) no mês. */
  folha: boolean;
  /** Tem plano de contas: do contador (planilha), do ERP, ou nenhum. */
  plano: "contador" | "erp" | null;
}

/**
 * Seletor de competência: ano + doze chips de mês (pedido do Léo, 07/09/2026).
 *
 * O ano NÃO é um segundo estado — sai da competência aberta. Trocar o ano abre
 * o último mês com dado daquele ano. Mês sem dado nenhum fica desabilitado, e
 * não escondido: sumir é diferente de vazio. Sob cada mês, dois pontos dizem
 * num relance o que ele tem: folha (dourado) e plano (marinho: cheio = planilha
 * do contador, vazado = montado do ERP).
 *
 * Teclado: a faixa é um radiogroup com tabindex itinerante — Tab entra e sai
 * numa parada só; ← → andam pelos meses COM dado, atravessando a virada do ano.
 */
export function FaixaMeses({
  competencias,
  ativa,
  onEscolher,
  info,
  hoje,
}: {
  competencias: string[];
  ativa: string;
  onEscolher: (competencia: string) => void;
  info: (competencia: string) => InfoMes;
  /** "AAAA-MM" de hoje — o mês corrente ganha um anel. */
  hoje?: string;
}) {
  const anos = useMemo(() => [...new Set(competencias.map((c) => c.slice(0, 4)))].sort(), [competencias]);
  const ano = ativa ? ativa.slice(0, 4) : anos[anos.length - 1] ?? "";
  const comDado = useMemo(() => new Set(competencias), [competencias]);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);

  const trocarAno = (novoAno: string) => {
    const doAno = competencias.filter((c) => c.startsWith(novoAno + "-"));
    if (doAno.length) onEscolher(doAno[doAno.length - 1]);
  };

  const andar = (delta: number) => {
    const i = competencias.indexOf(ativa);
    const alvo = competencias[i + delta];
    if (alvo) {
      onEscolher(alvo);
      // Foco segue a escolha, mesmo quando vira o ano (o chip nasce no próximo render).
      window.setTimeout(() => refs.current[Number(alvo.slice(5, 7)) - 1]?.focus(), 0);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); andar(1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); andar(-1); }
    else if (e.key === "Home") { e.preventDefault(); if (competencias[0]) onEscolher(competencias[0]); }
    else if (e.key === "End") { e.preventDefault(); const u = competencias[competencias.length - 1]; if (u) onEscolher(u); }
  };

  if (competencias.length === 0) {
    return <p className="text-sm text-slate-500">Sem competências com dados.</p>;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <Select value={ano} onChange={(e) => trocarAno(e.target.value)} className="h-10 w-auto py-0" aria-label="Ano">
        {anos.map((a) => <option key={a} value={a}>{a}</option>)}
      </Select>
      <div role="radiogroup" aria-label="Mês" className="grid flex-1 grid-cols-6 gap-1 sm:grid-cols-12" onKeyDown={onKeyDown}>
        {meses.map((c, i) => {
          const tem = comDado.has(c);
          const ativo = c === ativa;
          const { folha, plano } = tem ? info(c) : { folha: false, plano: null };
          const corrente = hoje === c;
          const descricao = tem
            ? `${MESES_PT[i]}/${ano}${folha ? ", com folha" : ""}${plano === "contador" ? ", plano do contador" : plano === "erp" ? ", plano do ERP" : ""}`
            : `${MESES_PT[i]}/${ano}: sem folha e sem plano`;
          return (
            <button
              key={c}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={ativo}
              aria-label={descricao}
              title={descricao}
              disabled={!tem}
              tabIndex={ativo ? 0 : -1}
              onClick={() => tem && onEscolher(c)}
              className={cn(
                "flex h-10 flex-col items-center justify-center rounded-lg border text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand",
                ativo
                  ? "border-brand bg-brand text-white"
                  : tem
                    ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    : "cursor-not-allowed border-dashed border-slate-200 bg-transparent text-slate-300",
                corrente && !ativo && "ring-1 ring-inset ring-gold",
              )}
            >
              <span>{MESES_PT[i].slice(0, 3)}</span>
              <span className="mt-0.5 flex h-1.5 items-center gap-1" aria-hidden="true">
                {folha && <span className={cn("h-1.5 w-1.5 rounded-full", ativo ? "bg-white/90" : "bg-gold")} />}
                {plano === "contador" && <span className={cn("h-1.5 w-1.5 rounded-full", ativo ? "bg-white/90" : "bg-current text-brand")} />}
                {plano === "erp" && <span className={cn("h-1.5 w-1.5 rounded-full ring-1 ring-inset", ativo ? "ring-white/90" : "ring-brand")} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Legenda dos pontos — uma linha, sempre visível (ponto colorido sozinho não é sinal). */
export function LegendaMeses() {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
      <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-gold" /> folha</span>
      <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-current text-brand" /> plano do contador</span>
      <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full ring-1 ring-inset ring-brand" /> plano do ERP</span>
      <span className="text-slate-400">· mês apagado: sem folha e sem plano</span>
    </p>
  );
}
