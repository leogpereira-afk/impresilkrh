/* QUANTO DA FICHA ESTÁ PREENCHIDO.
 *
 * Pedido da direção: "nos cadastros de tudo do RH eu quero % de quanto está
 * preenchido". Ficha pela metade só aparece quando ela é necessária — no
 * eSocial, no exame, no contato de emergência, na rescisão. Aí já é tarde.
 *
 * A % SOZINHA ENGANA, e por isso ela nunca aparece sozinha aqui: a cor vem do
 * que FALTA, não do número. Medido na base real em 19/08/2026, a média é 92% e
 * mesmo assim 5 das 33 fichas estão sem um campo que trava obrigação legal.
 * Uma barra verde de 92% teria escondido as cinco.
 */
import { completudeDaFicha, tomDaCompletude } from "@/lib/completudeCadastro";
import { cn } from "@/lib/cn";

const CORES = {
  bom: { barra: "bg-emerald-500", texto: "text-emerald-700" },
  atencao: { barra: "bg-amber-500", texto: "text-amber-700" },
  ruim: { barra: "bg-red-500", texto: "text-red-700" },
} as const;

/** Selo compacto, para a linha de uma lista. */
export function SeloCompletude({ colab }: { colab: Record<string, unknown> }) {
  const c = completudeDaFicha(colab);
  const tom = tomDaCompletude(c);
  if (c.pct === 100) return null; // ficha completa não precisa de selo
  return (
    <span
      className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", CORES[tom].texto,
        tom === "ruim" ? "bg-red-50" : tom === "atencao" ? "bg-amber-50" : "bg-emerald-50")}
      title={
        (c.faltamEssenciais
          ? `Falta campo obrigatório: ${c.faltam.filter((f) => f.peso === "essencial").map((f) => f.rotulo).join(", ")}\n\n`
          : "") + `Também falta: ${c.faltam.filter((f) => f.peso !== "essencial").map((f) => f.rotulo).join(", ") || "nada"}`
      }
    >
      {c.pct}%{c.faltamEssenciais > 0 && " ⚠"}
    </span>
  );
}

/** Bloco completo, para o topo da ficha. */
export function BlocoCompletude({ colab }: { colab: Record<string, unknown> }) {
  const c = completudeDaFicha(colab);
  const tom = tomDaCompletude(c);
  const essenciais = c.faltam.filter((f) => f.peso === "essencial");
  const resto = c.faltam.filter((f) => f.peso !== "essencial");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-600">Cadastro preenchido</span>
        <span className={cn("text-sm font-semibold tabular-nums", CORES[tom].texto)}>{c.pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all", CORES[tom].barra)} style={{ width: `${c.pct}%` }} />
      </div>

      {/* O QUE FALTA vem sempre, e o obrigatório vem primeiro e em vermelho.
          É a diferença entre "quase pronto" e "não admite ninguém". */}
      {essenciais.length > 0 && (
        <p className="mt-2 text-xs text-red-700">
          <b>Falta o obrigatório:</b> {essenciais.map((f) => f.rotulo).join(", ")}
        </p>
      )}
      {resto.length > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          Falta ainda: {resto.map((f) => f.rotulo).join(", ")}
        </p>
      )}
      {c.faltam.length === 0 && <p className="mt-2 text-xs text-emerald-700">Ficha completa.</p>}
    </div>
  );
}
