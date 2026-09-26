/* O cartão de cada pessoa em Férias.
 *
 * Pedido do Léo (26/09/2026): "melhorar esses cards de férias, colocar as
 * fotos do cadastro". Antes era nome, uma frase e outra frase com tudo junto
 * ("12 dias livres · 0 dias reservados · 2 aquisitivo(s) com prazo"): para
 * achar quem está de férias era preciso LER cada linha.
 *
 * Agora a situação é um selo de cor (de férias em verde, agendada em azul) e
 * saldo, reservas e prazos viram etiquetas curtas. A foto é a do cadastro;
 * sem foto, as iniciais (o Avatar já faz isso, e também quando a foto está
 * corrompida).
 *
 * A REGRA DOS SELOS É UMA FUNÇÃO PURA, com teste: o que não pode acontecer é o
 * aviso de prazo sumir, ou o "saldo a conferir" virar "0 dias livres" -- que
 * parece resposta e é falta de informação.
 */
import { Avatar } from "@/components/ui/misc";
import { LinkFicha } from "@/components/ui/link-ficha";
import { cn } from "@/lib/cn";

export type Tom = "verde" | "azul" | "ambar" | "cinza";
export interface Selo {
  texto: string;
  tom: Tom;
}

/** O pedaço de cada pessoa que os selos leem (é o que a tela já calcula). */
export interface DadosDoCartao {
  resumo: { disponivel: number | null; referencia?: boolean; agendados: number };
  prazos: unknown[];
  proxima: { fase: string; texto: string };
}

const CORES: Record<Tom, string> = {
  verde: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  azul: "bg-blue-50 text-blue-800 ring-blue-200",
  ambar: "bg-amber-50 text-amber-800 ring-amber-200",
  cinza: "bg-slate-50 text-slate-600 ring-slate-200",
};

/** A situação de agora: de férias, agendada, ou nada marcado. */
export function situacaoDaPessoa(l: DadosDoCartao): Selo | null {
  if (l.proxima.fase === "em-curso") return { texto: "De férias", tom: "verde" };
  if (l.proxima.fase === "futuro") return { texto: "Agendada", tom: "azul" };
  return null;
}

/** O texto ao lado do selo, sem repetir o selo. Todo texto de quem está de
 *  férias começa com "De férias · " (lib/feriasContagem); com o selo verde do
 *  lado, a tela dizia "De férias  De férias · volta em 11 dias". */
export function textoAoLadoDoSelo(l: DadosDoCartao): string {
  if (situacaoDaPessoa(l)?.texto === "De férias") return l.proxima.texto.replace(/^De férias · /, "");
  return l.proxima.texto;
}

/** Saldo, reservas e prazos, na ordem em que se lê. */
export function selosDaPessoa(l: DadosDoCartao): Selo[] {
  const s: Selo[] = [];
  // Saldo desconhecido NÃO é zero: "0 dias livres" pareceria uma resposta.
  if (l.resumo.disponivel === null) s.push({ texto: "Saldo a conferir", tom: "ambar" });
  else
    s.push({
      texto: `${l.resumo.disponivel} ${l.resumo.disponivel === 1 ? "dia livre" : "dias livres"}${l.resumo.referencia ? " · direito a confirmar" : ""}`,
      tom: l.resumo.referencia ? "ambar" : "cinza",
    });
  if (l.resumo.agendados > 0)
    s.push({ texto: `${l.resumo.agendados} ${l.resumo.agendados === 1 ? "dia reservado" : "dias reservados"}`, tom: "azul" });
  if (l.prazos.length > 0)
    s.push({ texto: `${l.prazos.length} aquisitivo(s) com prazo para conferir`, tom: "ambar" });
  return s;
}

function Etiqueta({ selo, forte }: { selo: Selo; forte?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] ring-1 ring-inset",
        forte ? "font-semibold" : "font-medium",
        CORES[selo.tom],
      )}
    >
      {selo.texto}
    </span>
  );
}

export function CartaoPessoaFerias({
  id,
  nome,
  foto,
  area,
  dados,
  acoes,
}: {
  id: string;
  nome: string;
  foto?: string | null;
  area: string;
  dados: DadosDoCartao;
  /** Os botões da direita (Detalhes, Programar) — a tela decide quais. */
  acoes: React.ReactNode;
}) {
  const situacao = situacaoDaPessoa(dados);
  return (
    <div className="grid gap-2.5 px-3 py-2.5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_auto] md:items-center">
      <div className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className="shrink-0"><Avatar nome={nome} foto={foto} /></span>
        <div className="min-w-0">
          <LinkFicha id={id} className="block break-words font-medium leading-snug">{nome}</LinkFicha>
          <p className="break-words text-xs text-slate-500">{area}</p>
        </div>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          {situacao && <Etiqueta selo={situacao} forte />}
          <span className={situacao?.tom === "verde" ? "font-medium text-emerald-700" : "text-slate-700"}>
            {textoAoLadoDoSelo(dados)}
          </span>
        </p>
        <p className="flex flex-wrap gap-1.5">
          {selosDaPessoa(dados).map((s) => (
            <Etiqueta key={s.texto} selo={s} />
          ))}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">{acoes}</div>
    </div>
  );
}
