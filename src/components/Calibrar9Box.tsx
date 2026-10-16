import { useState } from 'react';
import type { Avaliacao, Colaborador, Calibracao9Box } from '@/data/types';
import { Modal } from '@/components/ui/modal';
import { Campo, Select, Textarea } from '@/components/ui/form';
import { useSessao } from '@/lib/session';
import { podeGerir } from '@/lib/rbac';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/format';
type Nivel = Calibracao9Box['desempenho'];
export function Calibrar9Box({ pessoa, avaliacao, desempenho, potencial, onSalvar, onFechar }: {
  pessoa: Colaborador; avaliacao: Avaliacao; desempenho: Nivel; potencial: Nivel;
  onSalvar: (id: string, patch: Partial<Avaliacao>) => void; onFechar: () => void;
}) {
  const sessao = useSessao(); const toast = useToast();
  const [des, setDes] = useState(desempenho); const [pot, setPot] = useState(potencial);
  const [motivo, setMotivo] = useState('');
  const salvar = (restaurar = false) => {
    if (!podeGerir(sessao)) return;
    if (!motivo.trim()) return toast('Informe o motivo do ajuste.', 'erro');
    const registro: Calibracao9Box = { desempenho: des, potencial: pot, motivo: `${restaurar ? 'Retorno à avaliação: ' : ''}${motivo.trim()}`, em: new Date().toISOString(), por: sessao?.colaboradorId ?? null };
    try {
      onSalvar(avaliacao.id, { calibracao9Box: restaurar ? null : registro, historico9Box: [...(avaliacao.historico9Box ?? []), registro] });
      toast('Posição atualizada. Notas e critérios de promoção preservados.'); onFechar();
    } catch { toast('Não foi possível salvar. Mantenha esta janela aberta e tente novamente.', 'erro'); }
  };
  return <Modal aberto titulo="Ajustar posição na 9-Box" descricao={pessoa.nome} onFechar={onFechar} rodape={<>
    {avaliacao.calibracao9Box && <button className="btn-outline" onClick={() => salvar(true)}>Usar avaliação calculada</button>}
    <button className="btn-outline" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={() => salvar()}>Salvar posição</button>
  </>}>
    <p className="mb-3 text-sm text-slate-500">Ajuste de classificação deste ciclo. Não altera notas, potencial do cadastro nem elegibilidade para promoção.</p>
    <div className="grid grid-cols-2 gap-3">
      <Campo label="Desempenho"><Select aria-label="Desempenho" value={des} onChange={e => setDes(e.target.value as Nivel)}>{['Baixo','Médio','Alto'].map(n => <option key={n}>{n}</option>)}</Select></Campo>
      <Campo label="Potencial"><Select aria-label="Potencial" value={pot} onChange={e => setPot(e.target.value as Nivel)}>{['Baixo','Médio','Alto'].map(n => <option key={n}>{n}</option>)}</Select></Campo>
    </div>
    <Campo label="Motivo do ajuste"><Textarea aria-label="Motivo do ajuste" value={motivo} onChange={e => setMotivo(e.target.value)} /></Campo>
    {!!avaliacao.historico9Box?.length && <details className="mt-3 text-sm"><summary>Histórico de ajustes ({avaliacao.historico9Box.length})</summary><ul className="mt-2 space-y-2">{avaliacao.historico9Box.slice().reverse().map((r,i) => <li key={i}>{formatDate(r.em)} · {r.desempenho} / {r.potencial} — {r.motivo}</li>)}</ul></details>}
  </Modal>;
}
