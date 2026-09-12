import type { CicloPerformance, EntregaPerformance, PessoaPerformance, Plantao, RegraPerformance } from '@/data/performance';

export const REGRA_INICIAL: RegraPerformance = {
  pesos: { entrega: 35, qualidade: 30, prazo: 20, colaboracao: 15 },
  notaMinima: 80, qualidadeMinima: 80, tetoIndividual: 0, orcamento: 0, referencia: '',
};
export const CRITERIOS_COLABORACAO = ['Comunica impedimentos e combinações', 'Coopera com a equipe e organiza o local', 'Registra entrega e cuida dos materiais'];
export const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
export function novoCiclo(competencia: string): CicloPerformance {
  return { id: `performance-${competencia}`, competencia, regra: structuredClone(REGRA_INICIAL), pessoas: [], entregas: [], historico: [], atualizadoEm: '' };
}
export const novaPessoa = (colaboradorId: string): PessoaPerformance => ({ colaboradorId, habitual: 0, meta: 0, colaboracao: [null, null, null], evidenciaColaboracao: '', contexto: '' });
export const dinheiro = (v: number) => v.toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
export const horas = (min: number) => `${Math.floor(min/60)}h${String(Math.round(min%60)).padStart(2,'0')}`;
export const pontosEntrega = (e: EntregaPerformance) => e.complexidade * e.participacao / 100;
export function minutosTurno(inicio: string, fim: string, intervalo: number): number | null {
  if (![inicio,fim].every(v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) || !Number.isFinite(intervalo) || intervalo < 0) return null;
  const min = (v: string) => Number(v.slice(0,2))*60+Number(v.slice(3));
  const total = min(fim)-min(inicio)-intervalo;
  return total > 0 ? total : null;
}
export function validarPlantao(p: Plantao, demais: Plantao[]): string[] {
  const erros: string[] = [];
  if (!p.titulo.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(p.data) || !Number.isFinite(Date.parse(p.data)) || new Date(`${p.data}T12:00:00Z`).toISOString().slice(0,10)!==p.data) erros.push('Informe um título e uma data válida.');
  const min = minutosTurno(p.inicio,p.fim,p.intervaloMin);
  if (min===null) erros.push('Confira os horários e o intervalo. Para virar a noite, faça uma escala para cada dia.');
  if (!p.participantes.length) erros.push('Selecione pelo menos uma pessoa.');
  const ids = p.participantes.map(x=>x.colaboradorId);
  if (new Set(ids).size!==ids.length) erros.push('A mesma pessoa não pode aparecer duas vezes.');
  for (const x of p.participantes) {
    if ([x.realizadoMin,x.extrasMin].some(n=>n!==null&&(!Number.isFinite(n)||n<0||n>1440))) erros.push('As horas realizadas e extras devem estar entre zero e 24 horas.');
    if (x.situacao==='Realizado' && (x.realizadoMin===null || x.extrasMin===null)) erros.push('Informe as horas realizadas e as extras de quem concluiu o plantão, mesmo quando forem zero.');
    if (x.extrasMin!==null && x.realizadoMin!==null && x.extrasMin>x.realizadoMin) erros.push('Horas extras não podem ultrapassar as horas realizadas.');
    if (!p.cancelado && x.situacao!=='Dispensado' && demais.some(o=>o.id!==p.id&&!o.cancelado&&o.data===p.data&&o.inicio<p.fim&&o.fim>p.inicio&&o.participantes.some(y=>y.colaboradorId===x.colaboradorId&&y.situacao!=='Dispensado'))) erros.push('Uma pessoa já está escalada em horário coincidente. Confira as escalas do dia.');
  }
  return [...new Set(erros)];
}
export function validarRegra(r: RegraPerformance): string[] {
  const erros: string[]=[];
  const pesos=Object.values(r.pesos);
  if (pesos.some(n=>!Number.isFinite(n)||n<0) || Math.abs(pesos.reduce((a,b)=>a+b,0)-100)>.001) erros.push('Os pesos devem somar 100%.');
  if ([r.notaMinima,r.qualidadeMinima].some(n=>!Number.isFinite(n)||n<0||n>100)) erros.push('As notas mínimas devem ficar entre 0 e 100.');
  if ([r.tetoIndividual,r.orcamento].some(n=>!Number.isFinite(n)||n<0)) erros.push('Os limites financeiros não podem ser negativos.');
  return erros;
}
export function validarEntrega(e: EntregaPerformance, ciclo: CicloPerformance): string[] {
  const erros: string[]=[];
  if (!ciclo.pessoas.some(p=>p.colaboradorId===e.colaboradorId)) erros.push('Selecione uma pessoa do ciclo.');
  if (!e.os.id || !e.os.finalizadaEm || e.os.finalizadaEm.slice(0,7)!==ciclo.competencia) erros.push('A entrega deve pertencer ao mês em apuração.');
  if (!Number.isFinite(e.complexidade)||e.complexidade<1||e.complexidade>5||!Number.isInteger(e.complexidade)) erros.push('A complexidade deve ser de 1 a 5.');
  if (!Number.isFinite(e.participacao)||e.participacao<=0||e.participacao>100) erros.push('Informe a participação entre 0 e 100%.');
  const outras=ciclo.entregas.filter(x=>x.id!==e.id && x.os.id===e.os.id);
  if (outras.some(x=>x.colaboradorId===e.colaboradorId)) erros.push('Esta O.S. já está vinculada à pessoa. Edite o vínculo existente.');
  if (outras.reduce((n,x)=>n+x.participacao,0)+e.participacao>100.00001) erros.push('A participação da equipe nesta O.S. ultrapassa 100%.');
  if (outras.some(x=>x.complexidade!==e.complexidade)) erros.push('Use a mesma complexidade para todos da mesma O.S.');
  if (['execucao','externo'].includes(e.qualidade)||['atraso','externo'].includes(e.prazo)) { if(!e.justificativa.trim()) erros.push('Explique a causa do retrabalho ou atraso.'); }
  return erros;
}
export function apurarPessoa(ciclo: CicloPerformance, p: PessoaPerformance) {
  const linhas=ciclo.entregas.filter(e=>e.colaboradorId===p.colaboradorId);
  const aceitas=linhas.filter(e=>e.aceite&&e.evidencia.trim());
  const pontos=aceitas.reduce((a,b)=>a+pontosEntrega(b),0);
  const qualidadeBase=aceitas.filter(e=>e.qualidade!=='pendente');
  const pesoQual=qualidadeBase.reduce((a,b)=>a+pontosEntrega(b),0);
  const pesoRetrabalho=qualidadeBase.filter(e=>e.qualidade==='execucao').reduce((a,b)=>a+pontosEntrega(b),0);
  const prazoBase=aceitas.filter(e=>e.prazo==='no_prazo'||e.prazo==='atraso');
  const pesoPrazo=prazoBase.reduce((a,b)=>a+pontosEntrega(b),0);
  const notas={
    entrega:p.meta>0?Math.min(100,pontos/p.meta*100):null,
    qualidade:pesoQual>0?(1-pesoRetrabalho/pesoQual)*100:null,
    prazo:pesoPrazo>0?prazoBase.filter(e=>e.prazo==='no_prazo').reduce((a,b)=>a+pontosEntrega(b),0)/pesoPrazo*100:null,
    colaboracao:p.colaboracao.length===3&&p.colaboracao.every(n=>n!==null&&Number.isFinite(n)&&n>=0&&n<=100)&&p.evidenciaColaboracao.trim()?p.colaboracao.reduce<number>((a,b)=>a+(b??0),0)/3:null,
  };
  const pendencias=validarRegra(ciclo.regra);
  if (!linhas.length) pendencias.push('Vincule as O.S. entregues.');
  if (linhas.some(e=>!e.aceite||!e.evidencia.trim()||e.qualidade==='pendente'||e.prazo==='pendente')) pendencias.push('Confira aceite, evidência, qualidade e prazo das entregas.');
  for(const e of linhas) pendencias.push(...validarEntrega(e,ciclo));
  if(!Number.isFinite(p.habitual)||p.habitual<0||!Number.isFinite(p.meta)||p.meta<=p.habitual) pendencias.push('Defina a referência habitual e uma meta superior a ela.');
  if(!ciclo.regra.referencia.trim()) pendencias.push('Documente como as metas foram combinadas e a referência habitual.');
  const chaves=Object.keys(notas) as (keyof typeof notas)[];
  if(chaves.some(k=>ciclo.regra.pesos[k]>0 && notas[k]===null)) pendencias.push('Há critérios sem evidência suficiente para fechar a nota.');
  const nota=pendencias.length?null:chaves.reduce((n,k)=>n+(notas[k]??0)*ciclo.regra.pesos[k]/100,0);
  const elegivel=nota!==null&&nota>=ciclo.regra.notaMinima&&(notas.qualidade??0)>=ciclo.regra.qualidadeMinima&&pontos>p.habitual;
  const sugestao=elegivel?Math.round(ciclo.regra.tetoIndividual*nota!/100*100)/100:0;
  return {linhas,aceitas,pontos,notas,nota,elegivel,sugestao,pendencias:[...new Set(pendencias)]};
}
export function validarAprovacao(ciclo: CicloPerformance,p: PessoaPerformance,valor: number,justificativa: string): string[] {
  const a=apurarPessoa(ciclo,p);
  const erros=[...a.pendencias];
  if(!a.elegivel) erros.push('A apuração ainda não atende aos critérios de bonificação.');
  if(!Number.isFinite(valor)||valor<=0||valor>ciclo.regra.tetoIndividual) erros.push('O valor deve ser positivo e respeitar o teto individual.');
  const demais=ciclo.pessoas.filter(x=>x.colaboradorId!==p.colaboradorId).reduce((n,x)=>n+(x.aprovacao?.valor??0),0);
  if(demais+valor>ciclo.regra.orcamento||ciclo.regra.orcamento<=0) erros.push('O valor ultrapassa o orçamento disponível do mês.');
  if(!justificativa.trim()) erros.push('Registre a justificativa da aprovação.');
  return [...new Set(erros)];
}
