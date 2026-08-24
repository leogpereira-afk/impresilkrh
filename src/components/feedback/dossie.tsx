/* O QUE O SISTEMA JÁ SABE, na hora da conversa.
 *
 * A tela de Feedback dizia só QUEM está esperando. Quem ia conversar chegava
 * sem nada: sem saber que a pessoa faltou duas vezes, que recebeu R$ 2.400 de
 * hora extra, que fez a NR-35 mês passado, ou que a nota dela subiu. Estava
 * tudo no sistema, em quatro telas — e ninguém abre quatro telas antes de uma
 * conversa de dez minutos.
 *
 * Recolhido por padrão: a conversa é o assunto, o dossiê é apoio. Aberto de
 * cara empurraria os campos do formulário para baixo da dobra.
 *
 * O QUE NÃO TEM DADO APARECE COMO "sem registro", nunca como zero. Elogiar a
 * assiduidade de quem ninguém mediu é pior que não falar de assiduidade.
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, CalendarX2, Coins, Brain, GraduationCap, Info } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import type { Dossie } from "@/lib/dossieFeedback";

function Bloco({ icone, titulo, children }: { icone: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-2.5">
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {icone} {titulo}
      </p>
      <div className="text-xs text-slate-600">{children}</div>
    </div>
  );
}

const SemRegistro = ({ onde }: { onde: string }) => (
  <span className="text-slate-400">Sem registro de {onde} — não dá para falar disso com número.</span>
);

export function DossieDaConversa({ d, ajuste }: { d: Dossie; ajuste: boolean }) {
  const [aberto, setAberto] = useState(false);
  const { assiduidade: a, ganhos: g, perfil: p, desenvolvimento: dev } = d;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {aberto ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
        <span className="flex-1 text-xs font-medium text-slate-600">
          O que o sistema sabe — últimos {d.janelaMeses} meses
        </span>
        {/* Resumo na própria linha: quem não abrir ainda leva o essencial. */}
        <span className="flex flex-wrap gap-1.5 text-[11px]">
          {a.temDados && a.faltas > 0 && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">{a.faltas} falta{a.faltas > 1 ? "s" : ""}</span>
          )}
          {g.temDados && g.total > 0 && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">+{formatBRL(g.total)}</span>
          )}
          {dev.tendencia && (
            <span className={`rounded-full px-2 py-0.5 ${dev.tendencia === "subiu" ? "bg-emerald-50 text-emerald-700" : dev.tendencia === "caiu" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>
              nota {dev.tendencia}
            </span>
          )}
        </span>
      </button>

      {aberto && (
        <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
          <Bloco icone={<CalendarX2 className="h-3.5 w-3.5" />} titulo="Assiduidade">
            {a.temDados ? (
              <ul className="space-y-0.5">
                <li>{a.faltas} falta(s) · {a.atestados} atestado(s)</li>
                <li>{a.horasExtras.toLocaleString("pt-BR")} h extras · {a.horasFalta.toLocaleString("pt-BR")} h de falta</li>
                <li className="text-slate-400">apurado em {a.meses} {a.meses === 1 ? "mês" : "meses"} de ponto</li>
              </ul>
            ) : <SemRegistro onde="ponto" />}
          </Bloco>

          <Bloco icone={<Coins className="h-3.5 w-3.5" />} titulo="Ganhou além do salário">
            {g.temDados ? (
              g.total > 0 ? (
                <ul className="space-y-0.5">
                  <li className="font-medium text-slate-700">{formatBRL(g.total)} no período</li>
                  {g.porTipo.slice(0, 4).map((x) => (
                    <li key={x.tipo}>{x.tipo}: {formatBRL(x.valor)}</li>
                  ))}
                </ul>
              ) : <span className="text-slate-500">Só o salário no período.</span>
            ) : <SemRegistro onde="pagamento" />}
          </Bloco>

          <Bloco icone={<Brain className="h-3.5 w-3.5" />} titulo="Perfil e como falar">
            {p.temDados ? (
              <div className="space-y-1">
                <p>
                  {p.comportamental ?? "—"}
                  {p.humor && <span className="text-slate-400"> · {p.humor}</span>}
                  {p.aprendizagem && <span className="text-slate-400"> · aprende melhor {p.aprendizagem}</span>}
                </p>
                {/* A orientação certa para o TIPO de conversa: ajuste puxa o
                    "notícias ruins", elogio puxa o "feedback". Esse texto já
                    existia em constants.ts e nunca tinha chegado a esta tela. */}
                {(ajuste ? p.noticiaRuim : p.comoFalar) && (
                  <p className="rounded bg-brand/5 px-2 py-1 text-brand-ink">
                    {ajuste ? p.noticiaRuim : p.comoFalar}
                  </p>
                )}
                {ajuste && p.evite && <p className="text-amber-700">Evite: {p.evite}</p>}

                {/* O QUE O RH ESCREVEU sobre a pessoa. Separado do resto por
                    uma linha, de propósito: tudo acima é número apurado, isto
                    é opinião de quem acompanha. Misturar os dois faria a
                    opinião parecer medição. */}
                {(p.pontosFortes || p.pontosMelhoria) && (
                  <div className="mt-1.5 space-y-1 border-t border-slate-100 pt-1.5">
                    {p.pontosFortes && (
                      <p><span className="font-medium text-emerald-700">Fortes:</span> {p.pontosFortes}</p>
                    )}
                    {p.pontosMelhoria && (
                      <p><span className="font-medium text-amber-700">A melhorar:</span> {p.pontosMelhoria}</p>
                    )}
                  </div>
                )}
              </div>
            ) : <SemRegistro onde="perfil comportamental" />}
          </Bloco>

          <Bloco icone={<GraduationCap className="h-3.5 w-3.5" />} titulo="Desenvolvimento">
            {dev.temDados ? (
              <ul className="space-y-0.5">
                {dev.notaFinal != null && (
                  <li>
                    Última nota <b className="text-slate-700">{dev.notaFinal}</b>
                    {dev.statusDesempenho && <span className="text-slate-400"> · {dev.statusDesempenho}</span>}
                    {dev.tendencia && <span className="text-slate-400"> · {dev.tendencia}</span>}
                  </li>
                )}
                {dev.concluidos.length > 0 && (
                  <li>Concluiu: {dev.concluidos.slice(0, 3).map((c) => c.titulo).join(", ")}
                    {dev.concluidos[0]?.em && <span className="text-slate-400"> (último em {formatDate(dev.concluidos[0].em)})</span>}
                  </li>
                )}
                {dev.pendentes.length > 0 && <li className="text-amber-700">Pendente: {dev.pendentes.slice(0, 3).join(", ")}</li>}
                {dev.planoAcao && <li className="text-slate-500">Plano: {dev.planoAcao}</li>}
              </ul>
            ) : <SemRegistro onde="treinamento e avaliação" />}
          </Bloco>

          {d.semDados.length > 0 && (
            <p className="flex items-start gap-1.5 text-[11px] text-slate-400 sm:col-span-2">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Sem dados de {d.semDados.join(", ")}. O que falta aqui não é ausência de fato — é ausência de registro.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
