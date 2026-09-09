import { useState } from 'react';
import type { Colaborador, Ferias } from '@/data/types';
import { Modal } from '@/components/ui/modal';
import { Campo, Input, Select, Textarea } from '@/components/ui/form';
import { diaLocalISO, diasDeCalendario, formatDate } from '@/lib/format';
import { useHoje } from '@/lib/useHoje';
import { aquisitivoDe, dataFerias, deslocarDia, duracaoFerias, estadoFerias, opcoesAquisitivos, periodosFerias, prepararDireitoFerias, validarRegistroFerias } from '@/lib/feriasPeriodos';

export function FormularioFerias({colaborador,registros,registro=null,inicial=null,onFechar,onSalvar}:{
  colaborador:Colaborador; registros:Ferias[]; registro?:Ferias|null;
  inicial?:{inicio:string;fim:string}|null; onFechar:()=>void;
  onSalvar:(dados:Omit<Ferias,'id'>,ajustes:Array<{id:string;direitoDias:number}>)=>void;
}) {
  const hoje=useHoje();
  const opcoes=opcoesAquisitivos(colaborador,registros,hoje);
  const sugerido=opcoes.filter(p=>diasDeCalendario(p.fim,hoje)<0 && p.disponivel>0).sort((a,b)=>Number(a.referencia)-Number(b.referencia) || +b.inicio-+a.inicio)[0] ?? opcoes[0];
  const dia=(v?:string|null)=>{const d=dataFerias(v);return d ? diaLocalISO(d):'';};
  const [aqInicio,setAqInicio]=useState(dia(registro?.periodoAquisitivoInicio) || inicial?.inicio || (sugerido ? diaLocalISO(sugerido.inicio):''));
  const [aqFim,setAqFim]=useState(dia(registro?.periodoAquisitivoFim) || inicial?.fim || (sugerido ? diaLocalISO(sugerido.fim):''));
  const grupo=periodosFerias(registros,hoje).find(p=>p.chave===aquisitivoDe({periodoAquisitivoInicio:aqInicio,periodoAquisitivoFim:aqFim})?.chave);
  const [direito,setDireito]=useState(String(registro?.direitoDias ?? grupo?.direito ?? 30));
  const [abono,setAbono]=useState(registro?.abonoDias==null && /abono/i.test(registro?.observacao??'') ? '' : String(registro?.abonoDias??0));
  const [inicio,setInicio]=useState(dia(registro?.dataInicio));
  const [retorno,setRetorno]=useState(dia(registro?.dataRetorno));
  const [dias,setDias]=useState(String(registro ? duracaoFerias(registro) || 30 : 30));
  const [status,setStatus]=useState(registro?.status==='Cancelada'||registro?.status==='Concluída' ? registro.status : 'automatico');
  const [obs,setObs]=useState(registro?.observacao??'');
  const [confirmado,setConfirmado]=useState(registro?.direitoDias!=null);
  const [tentou,setTentou]=useState(false);
  const guardar=(antigo:string|null|undefined,v:string)=>dia(antigo)===v ? antigo??null : v||null;
  const draft:Ferias={...registro,id:registro?.id??'novo',colaboradorId:colaborador.id,
    periodoAquisitivoInicio:guardar(registro?.periodoAquisitivoInicio,aqInicio),periodoAquisitivoFim:guardar(registro?.periodoAquisitivoFim,aqFim),
    dataInicio:guardar(registro?.dataInicio,inicio),dataRetorno:guardar(registro?.dataRetorno,retorno),
    direitoDias:direito==='' ? NaN:Number(direito),abonoDias:abono==='' ? NaN:Number(abono),
    diasGozados:!inicio && status==='Concluída' ? Number(dias):0,saldoDias:0,status:status==='automatico'?'Em aberto':status,observacao:obs.trim()||null};
  if (status==='automatico') {const estado=estadoFerias(draft,hoje);draft.status=estado==='Conferir datas'?'Em aberto':estado;}
  if (draft.status==='Concluída') draft.diasGozados=duracaoFerias(draft)??0;
  const direitoAquisitivo=prepararDireitoFerias(draft,registros);
  const previstos=periodosFerias([...direitoAquisitivo.previstos.filter(f=>f.id!==draft.id),draft],hoje);
  const depois=previstos.find(p=>p.chave===aquisitivoDe(draft)?.chave);
  draft.saldoDias=Math.max(0,depois?.disponivel??0);
  const erros=validarRegistroFerias(draft,direitoAquisitivo.previstos,hoje);
  if (!confirmado && status!=='Cancelada') erros.push('Confirme o vínculo, o aquisitivo e o direito em dias antes de salvar.');
  const inicioData=dataFerias(inicio);
  const pagamentoAte=inicioData ? deslocarDia(inicioData,-2):null;
  const recalcular=(i:string,n:string)=>{const d=dataFerias(i),q=Number(n);if(d&&Number.isInteger(q)&&q>0&&q<=30)setRetorno(diaLocalISO(deslocarDia(d,q)));};
  const salvar=()=>{setTentou(true);if(erros.length)return;const dados={...(registro && status==='Cancelada' ? {...registro,status:'Cancelada'} : draft)};delete (dados as Partial<Ferias>).id;onSalvar(dados,direitoAquisitivo.ajustes);};
  return <Modal aberto largura="max-w-2xl" onFechar={onFechar} titulo={registro?'Editar férias':'Programar férias'}
    descricao={colaborador.nome} rodape={<><button className="btn-outline" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}>Salvar férias</button></>}>
    <div className="space-y-4">
      <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900">O saldo considera apenas este aquisitivo, descontando gozos, reservas futuras e dias vendidos. Cada lançamento representa uma fração.</p>
      {!registro && opcoes.length>0 && <Campo label="Escolher aquisitivo"><Select value={aquisitivoDe(draft)?.chave??''} onChange={e=>{const p=opcoes.find(p=>p.chave===e.target.value);if(p){setAqInicio(diaLocalISO(p.inicio));setAqFim(diaLocalISO(p.fim));setDireito(String(p.direito));setConfirmado(false);}}}>
        <option value="">Informar datas abaixo</option>{opcoes.map(p=><option key={p.chave} value={p.chave}>{formatDate(p.inicio)} a {formatDate(p.fim)} · {p.referencia?'referência a conferir':`${p.disponivel} dias livres`}</option>)}
      </Select></Campo>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Aquisitivo — início" obrigatorio><Input aria-label="Aquisitivo — início" type="date" value={aqInicio} onChange={e=>{setAqInicio(e.target.value);setConfirmado(false);}} /></Campo>
        <Campo label="Aquisitivo — fim" obrigatorio><Input aria-label="Aquisitivo — fim" type="date" value={aqFim} onChange={e=>{setAqFim(e.target.value);setConfirmado(false);}} /></Campo>
        <Campo label="Direito no aquisitivo (dias)" hint="30 é referência, não confirmação automática."><Input aria-label="Direito no aquisitivo (dias)" type="number" min={0} max={30} value={direito} onChange={e=>{setDireito(e.target.value);setConfirmado(false);}} /></Campo>
        <Campo label="Dias vendidos neste lançamento" hint="Abono já registrado em outra fração não deve ser repetido."><Input aria-label="Dias vendidos neste lançamento" type="number" min={0} max={10} value={abono} onChange={e=>setAbono(e.target.value)} /></Campo>
        <Campo label="Início do gozo"><Input aria-label="Início do gozo" type="date" value={inicio} onChange={e=>{setInicio(e.target.value);recalcular(e.target.value,dias);}} /></Campo>
        <Campo label="Duração do gozo (dias)"><Input aria-label="Duração do gozo (dias)" type="number" min={1} max={30} value={dias} onChange={e=>{setDias(e.target.value);recalcular(inicio,e.target.value);}} /></Campo>
        <Campo label="Retorno ao trabalho" hint="Dia seguinte ao último dia de férias."><Input aria-label="Retorno ao trabalho" type="date" value={retorno} onChange={e=>{setRetorno(e.target.value);const q=duracaoFerias({...draft,dataRetorno:e.target.value});if(q)setDias(String(q));}} /></Campo>
        <Campo label="Situação"><Select aria-label="Situação das férias" value={status} onChange={e=>setStatus(e.target.value)}><option value="automatico">Conforme as datas</option><option value="Concluída">Concluída</option>{registro && <option value="Cancelada">Cancelada</option>}</Select></Campo>
      </div>
      <div className="rounded-lg border border-slate-200 p-3 text-sm space-y-1" aria-live="polite">
        <p><strong>Após salvar: {depois && Number.isFinite(depois.disponivel)?`${depois.disponivel} dias livres`:'confira os campos'}</strong></p>
        {depois && <p>{depois.gozados} gozados · {depois.emCurso} em curso · {depois.agendados} agendados · {depois.abono} vendidos</p>}
        {pagamentoAte && <p>Pagamento de férias: conferir até {formatDate(pagamentoAte)}. A agenda não comprova pagamento.</p>}
        {depois && retorno && dataFerias(retorno)!>deslocarDia(depois.limite,1) && <p className="text-amber-800">O último dia do gozo ultrapassa o prazo de {formatDate(depois.limite)}. Confira com o RH.</p>}
      </div>
      {direitoAquisitivo.ajustes.length>0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Ao salvar, o direito de {direito} dias também será aplicado a {direitoAquisitivo.ajustes.length} outra(s) fração(ões) deste aquisitivo. Datas e dias vendidos dessas frações serão preservados.</p>}
      <Campo label="Observação"><Textarea aria-label="Observação das férias" value={obs} onChange={e=>setObs(e.target.value)} /></Campo>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmado} onChange={e=>setConfirmado(e.target.checked)} />Conferi o vínculo, o aquisitivo e o direito em dias desta pessoa.</label>
      <p className="text-xs text-slate-500">Antes de agendar: confira aviso com antecedência, concordância com a divisão e os feriados e descansos da escala. Não iniciar nos dois dias anteriores a feriado ou repouso semanal. Antecipações e férias coletivas exigem análise própria.</p>
      {tentou && erros.length>0 && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800"><p className="font-semibold">Revise antes de salvar</p><ul className="list-disc pl-5">{erros.map(e=><li key={e}>{e}</li>)}</ul></div>}
    </div>
  </Modal>;
}
