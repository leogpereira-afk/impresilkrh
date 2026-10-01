/* A TELA PERFORMANCE DO RH SAIU DO MENU (F25, 01/10/2026).
 *
 * Regra do dono: no RH fica só o que remete à pessoa. O programa das equipes
 * (ranking, pontos, comissão e prêmios) mora no PCP, na aba Performance, onde a
 * participação de cada pessoa é lançada dentro da O.S., com divisão e registro
 * de quem mudou. Com as duas telas no ar, a mesma pessoa tinha dois números no
 * mesmo mês.
 *
 * A rota /performance continua de pé para quem guardou o endereço: em vez da
 * apuração antiga, mostra este aviso com o caminho do PCP. Nada foi apagado do
 * banco. As apurações antigas (performanceCiclos) seguem guardadas e, para o RH,
 * aparecem aqui SÓ PARA CONSULTA, em PDF: esta tela não tem nenhum botão que
 * grave. O servidor (sync) já congela o vínculo de O.S. desde a F02.
 */
import { useState } from 'react';
import { ExternalLink, FileDown, Trophy } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { useColecao } from '@/lib/store';
import { useSessao } from '@/lib/session';
import { useDominio } from '@/lib/dominio';
import { idPessoa } from '@/lib/identidade';
import { dinheiro } from '@/lib/performance';
import { exportarPerformance } from '@/lib/performancePdf';
import type { CicloPerformance } from '@/data/performance';

/** Endereço do PCP no ar (repositório leogpereira-afk/impresilk, GitHub Pages). */
export const URL_PCP = 'https://leogpereira-afk.github.io/impresilk/';

const mesAno = (competencia: string) => `${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`;

function ApuracoesAntigas() {
  const d = useDominio();
  const toast = useToast();
  const store = useColecao('performanceCiclos');
  const [baixando, setBaixando] = useState('');
  const ciclos = [...store.items].sort((a, b) => String(b.competencia).localeCompare(String(a.competencia)));
  if (!ciclos.length) return null;
  const nomePessoa = (id: string) => `${d.nomeColab(id)} · ID ${idPessoa(d.colabById.get(id)?.cpf) ?? id}`;
  const pdf = async (c: CicloPerformance) => {
    setBaixando(c.competencia);
    try { await exportarPerformance(c, nomePessoa); }
    catch { toast('Não foi possível gerar o PDF.', 'erro'); }
    finally { setBaixando(''); }
  };
  return (
    <details className="card px-4 py-3">
      <summary className="cursor-pointer font-semibold text-brand">Apurações antigas guardadas no RH ({ciclos.length})</summary>
      <p className="mt-3 text-sm text-slate-500">Só consulta. Estas apurações foram feitas na tela antiga e continuam guardadas como estavam. Nada aqui grava ou muda.</p>
      <ul className="mt-3 space-y-2">
        {ciclos.map((c) => {
          const pessoas = c.pessoas ?? [];
          const aprovadas = pessoas.filter((p) => p.aprovacao);
          const total = aprovadas.reduce((n, p) => n + (p.aprovacao?.valor ?? 0), 0);
          return (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
              <div>
                <p className="font-semibold">{mesAno(c.competencia)}</p>
                <p className="text-sm text-slate-500">
                  {pessoas.length} pessoa(s) · {(c.entregas ?? []).length} vínculo(s) de O.S. · {aprovadas.length} proposta(s) aprovada(s){aprovadas.length ? `, ${dinheiro(total)}` : ''}
                </p>
              </div>
              <button className="btn-outline min-h-10" disabled={!!baixando} onClick={() => void pdf(c)}>
                <FileDown className="h-4 w-4" />{baixando === c.competencia ? 'Gerando…' : 'Baixar PDF'}
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export default function Performance() {
  const sessao = useSessao();
  return (
    <div className="space-y-4">
      <PageHeader title="Performance" description="O programa das equipes de instalação agora fica no PCP." />
      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-brand"><Trophy className="h-5 w-5 shrink-0" />O programa das equipes mudou para o PCP</h2>
        <p className="max-w-3xl text-sm text-slate-600">Ranking, pontos, comissão e prêmios das equipes ficam no PCP, na aba <b>Performance</b>. A participação de cada pessoa é lançada dentro da O.S., e o fechamento do mês sai de lá.</p>
        <p className="max-w-3xl text-sm text-slate-600">No RH fica o que é da pessoa: cadastro, ponto, férias, folha e desenvolvimento.</p>
        <a className="btn-primary inline-flex min-h-11" href={URL_PCP} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-4 w-4" />Abrir o PCP
        </a>
      </section>
      {sessao?.perfil === 'ADMIN_RH' && <ApuracoesAntigas />}
    </div>
  );
}
