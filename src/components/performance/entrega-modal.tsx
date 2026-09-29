import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { idPessoa } from '@/lib/identidade';
import { useDominio } from '@/lib/dominio';
import { buscarOrdensPerformance } from '@/lib/performanceOS';
import { formatDate } from '@/lib/format';
import type { EntregaPerformance, OrdemPerformance } from '@/data/performance';

/* SÓ CONSULTA desde 29/09/2026 (F02). O percentual de cada pessoa na O.S. passou
   a ser lançado dentro da O.S., no PCP, com divisão e registro de quem mudou.
   Este modal gravava vínculo e participação em performanceCiclos: um segundo
   número para a mesma pessoa na mesma O.S. Agora mostra o vínculo já guardado e
   o retrato atual do PCP, sem salvar nem remover. O servidor (sync) também
   recusa qualquer mudança na lista de entregas, para a tela velha aberta em
   outra aba não gravar por fora. */
const QUALIDADE: Record<EntregaPerformance['qualidade'], string> = { pendente: 'A conferir', sem_retrabalho: 'Sem retrabalho de execução', execucao: 'Retrabalho atribuído à execução', externo: 'Ocorrência externa à execução' };
const PRAZO: Record<EntregaPerformance['prazo'], string> = { pendente: 'A conferir', no_prazo: 'Entregue no prazo combinado', atraso: 'Atraso sob controle da equipe', externo: 'Impedimento externo, fora do indicador' };

export function EntregaModal({competencia,registro,onFechar}:{competencia:string;registro:EntregaPerformance;onFechar:()=>void}) {
  const d=useDominio();
  const nomePessoa=(id:string)=>`${d.nomeColab(id)} · ID ${idPessoa(d.colabById.get(id)?.cpf)??id}`;
  const [ordens,setOrdens]=useState<OrdemPerformance[]>([]); const [carregando,setCarregando]=useState(false);const [erro,setErro]=useState('');const [consulta,setConsulta]=useState('');
  const os=registro.os;
  const osAtual=ordens.find(o=>o.id===os.id);
  const retratoDiferente=!!osAtual&&JSON.stringify(osAtual)!==JSON.stringify(os);
  const consultar=useCallback(async()=>{setCarregando(true);setErro('');try{const r=await buscarOrdensPerformance(competencia);setOrdens(r.ordens);setConsulta(r.consultadoEm);}catch(e){setErro(e instanceof Error?e.message:'Não foi possível consultar.');}finally{setCarregando(false);}},[competencia]);
  useEffect(()=>{void consultar();},[consultar]); // modal é montado para uma única competência
  return <Modal aberto onFechar={onFechar} titulo="Vínculo de O.S. guardado" largura="max-w-3xl" rodape={<button className="btn-primary" onClick={onFechar}>Fechar</button>}><div className="space-y-4">
    <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">A participação de cada pessoa na O.S. agora é lançada dentro da O.S., no PCP. Aqui fica só a consulta do que já estava guardado nesta apuração.</p>
    {erro&&<div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">O.S. {os.numero} · {os.cliente}</p><button className="btn-outline" disabled={carregando} onClick={()=>void consultar()}><RefreshCw className="h-4 w-4"/>{carregando?'Consultando…':'Atualizar PCP'}</button></div>
    <div className="rounded-xl bg-slate-50 p-4 text-sm"><p className="font-semibold">{os.servico||'Serviço sem descrição'}</p><p>Conclusão: {formatDate(os.finalizadaEm)} · Prazo: {os.prazo?formatDate(os.prazo):'Não informado'}</p><p>Equipe indicada no PCP: {os.equipe.join(', ')||'Não informada'}</p><p>{os.retrabalho?'Há retrabalho marcado no PCP.':'Sem marcação de retrabalho no PCP.'}</p></div>
    {consulta&&!osAtual&&<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Esta O.S. não aparece entre as concluídas deste mês na consulta atual. Confira no PCP.</p>}
    {retratoDiferente&&<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">A O.S. tem dados diferentes no PCP agora. Você está vendo o retrato guardado quando o vínculo foi feito.</p>}
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
      <div><dt className="text-slate-500">Pessoa</dt><dd className="font-medium">{nomePessoa(registro.colaboradorId)}</dd></div>
      <div><dt className="text-slate-500">Participação guardada</dt><dd className="font-medium">{registro.participacao}%</dd></div>
      <div><dt className="text-slate-500">Complexidade</dt><dd className="font-medium">{registro.complexidade}/5</dd></div>
      <div><dt className="text-slate-500">Aceite</dt><dd className="font-medium">{registro.aceite?'Conferido':'Pendente'}</dd></div>
      <div><dt className="text-slate-500">Qualidade</dt><dd className="font-medium">{QUALIDADE[registro.qualidade]??registro.qualidade}</dd></div>
      <div><dt className="text-slate-500">Prazo</dt><dd className="font-medium">{PRAZO[registro.prazo]??registro.prazo}</dd></div>
    </dl>
    {!!registro.evidencia&&<div className="text-sm"><p className="text-slate-500">Evidência</p><p className="whitespace-pre-wrap">{registro.evidencia}</p></div>}
    {!!registro.justificativa&&<div className="text-sm"><p className="text-slate-500">Causa e justificativa</p><p className="whitespace-pre-wrap">{registro.justificativa}</p></div>}
  </div></Modal>;
}
