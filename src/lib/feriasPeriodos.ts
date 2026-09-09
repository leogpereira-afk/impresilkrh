import type { Colaborador, Ferias } from '@/data/types';
import { diaLocalISO, diasDeCalendario, parseData } from './format';

/** Data civil validada: o calendário não pode normalizar 31/02 para março. */
export function dataFerias(valor?: string | null): Date | null {
  if (!valor) return null;
  const texto = valor.trim();
  if (!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(texto)) return null;
  const partes=texto.slice(0,10).split('-').map(Number);
  const civil=new Date(partes[0],partes[1]-1,partes[2],12);
  if (diaLocalISO(civil)!==texto.slice(0,10)) return null;
  const d = parseData(texto);
  if (!d || !Number.isFinite(d.getTime())) return null;
  if (texto.length === 10 && diaLocalISO(d) !== texto) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
}
export function somarAnosFerias(d: Date, anos: number): Date {
  const ano = d.getFullYear() + anos, mes = d.getMonth();
  return new Date(ano, mes, d.getDate(), 12);
}
export function deslocarDia(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
}
export function anosCompletosFerias(inicio: Date, hoje: Date): number {
  let anos = hoje.getFullYear() - inicio.getFullYear();
  if (diasDeCalendario(somarAnosFerias(inicio, anos), hoje) > 0) anos--;
  return Math.max(0, anos);
}
export function aquisitivoDe(f: Pick<Ferias,'periodoAquisitivoInicio'|'periodoAquisitivoFim'>) {
  const inicio = dataFerias(f.periodoAquisitivoInicio), fimGravado = dataFerias(f.periodoAquisitivoFim);
  if (!inicio || !fimGravado || fimGravado <= inicio) return null;
  // A tela antiga gravava o aniversário como fim; a ficha gravava a véspera.
  // Agrupa as duas convenções sem reescrever os registros do usuário.
  const aniversario = somarAnosFerias(inicio, 1);
  const fim = +fimGravado === +aniversario ? deslocarDia(aniversario, -1) : fimGravado;
  const limite = deslocarDia(somarAnosFerias(deslocarDia(fim, 1), 1), -1);
  return { chave: `${diaLocalISO(inicio)}/${diaLocalISO(fim)}`, inicio, fim, limite };
}
export type EstadoFerias = 'Em aberto'|'Agendada'|'Em andamento'|'Concluída'|'Cancelada'|'Conferir datas';
export function estadoFerias(f: Ferias, hoje = new Date()): EstadoFerias {
  if (f.status === 'Cancelada' || f.status === 'Concluída') return f.status;
  if (!f.dataInicio && !f.dataRetorno) return 'Em aberto';
  const i=dataFerias(f.dataInicio), r=dataFerias(f.dataRetorno);
  if (!i || !r || r <= i) return 'Conferir datas';
  if (diasDeCalendario(i, hoje)>0) return 'Agendada';
  return diasDeCalendario(r, hoje)>0 ? 'Em andamento' : 'Concluída';
}
export function duracaoFerias(f: Ferias): number | null {
  const i=dataFerias(f.dataInicio), r=dataFerias(f.dataRetorno);
  if (i && r && r>i) return diasDeCalendario(r,i);
  if (f.status === 'Concluída' && Number.isInteger(f.diasGozados) && f.diasGozados>0) return f.diasGozados;
  return !f.dataInicio && !f.dataRetorno && !f.diasGozados ? 0 : null;
}
export interface PeriodoFerias {
  chave: string; inicio: Date; fim: Date; limite: Date; registros: Ferias[];
  direito: number; direitoConfirmado: boolean; gozados: number; emCurso: number;
  agendados: number; abono: number; disponivel: number; aConceder: number;
  pendencias: string[]; referencia: boolean;
}
/** Saldo pertence ao aquisitivo. Nunca somar saldos repetidos das frações. */
export function periodosFerias(registros: readonly Ferias[], hoje = new Date()): PeriodoFerias[] {
  const mapa = new Map<string, PeriodoFerias>();
  for (const f of registros) {
    if (f.status === 'Cancelada') continue;
    const aq=aquisitivoDe(f); if (!aq) continue;
    const identidade=`${f.colaboradorId}:${aq.chave}`;
    const p=mapa.get(identidade) ?? {...aq,registros:[],direito:30,direitoConfirmado:false,gozados:0,emCurso:0,agendados:0,abono:0,disponivel:0,aConceder:0,pendencias:[],referencia:false};
    p.registros.push(f); mapa.set(identidade,p);
  }
  for (const p of mapa.values()) {
    const direitos=[...new Set(p.registros.flatMap(f=>f.direitoDias == null ? [] : [f.direitoDias]))];
    if (direitos.length===1 && Number.isInteger(direitos[0]) && direitos[0]>=0 && direitos[0]<=30) {p.direito=direitos[0];p.direitoConfirmado=true;}
    else if (direitos.length) p.pendencias.push('Direito em dias inválido ou diferente entre as frações.');
    for (const f of p.registros) {
      const estado=estadoFerias(f,hoje), duracao=duracaoFerias(f);
      if (f.status==='Concluída' && f.diasGozados>0 && duracao!==null && duracao!==f.diasGozados) p.pendencias.push('Dias gozados divergem da duração entre início e retorno.');
      if (f.status==='Concluída' && dataFerias(f.dataRetorno) && diasDeCalendario(dataFerias(f.dataRetorno),hoje)>0) p.pendencias.push('Concluído com retorno futuro: confira as datas realizadas.');
      if (estado==='Concluída' && !duracao) p.pendencias.push('Gozo concluído sem quantidade: confira o histórico.');
      if (duracao===null || estado==='Conferir datas') p.pendencias.push('Gozo com datas ou quantidade incompletas.');
      else if (estado==='Agendada') p.agendados+=duracao;
      else if (estado==='Em andamento') p.emCurso+=duracao;
      else if (estado==='Concluída') p.gozados+=duracao;
      else if (f.diasGozados>0) p.pendencias.push('Dias gozados sem identificação do gozo.');
      if (f.abonoDias == null && /abono/i.test(f.observacao ?? '')) p.pendencias.push('Abono mencionado na observação: confirme a quantidade no campo de dias vendidos.');
      if (f.abonoDias != null) {
        if (!Number.isInteger(f.abonoDias) || f.abonoDias<0) p.pendencias.push('Dias vendidos inválidos.');
        else p.abono+=f.abonoDias;
      }
    }
    for (const f of p.registros) {
      const inicio=dataFerias(f.dataInicio),retorno=dataFerias(f.dataRetorno);
      if (!inicio||!retorno) continue;
      if (registros.some(outro=>{if(outro.id===f.id||outro.colaboradorId!==f.colaboradorId||outro.status==='Cancelada')return false;const i=dataFerias(outro.dataInicio),r=dataFerias(outro.dataRetorno);return i&&r&&inicio<r&&i<retorno;})) p.pendencias.push('Há gozos sobrepostos no histórico desta pessoa.');
    }
    p.disponivel=p.direito-p.gozados-p.emCurso-p.agendados-p.abono;
    p.aConceder=p.direito-p.gozados-p.abono;
    if (p.disponivel<0) p.pendencias.push('Gozo e reservas ultrapassam o direito deste aquisitivo.');
    if (p.abono>Math.floor(p.direito/3)) p.pendencias.push('Abono acima de um terço do direito.');
    p.pendencias=[...new Set(p.pendencias)];
  }
  return [...mapa.values()].sort((a,b)=>+a.inicio-+b.inicio);
}
/** Referências de calendário não viram dívida nem registro automaticamente. */
export function opcoesAquisitivos(c: Colaborador, registros: readonly Ferias[], hoje=new Date()): PeriodoFerias[] {
  const existentes=periodosFerias(registros,hoje), mapa=new Map(existentes.map(p=>[p.chave,p]));
  const adm=dataFerias(c.dataAdmissao), saida=dataFerias(c.dataDesligamento);
  const ate=saida && saida<hoje ? saida : hoje;
  if (adm && adm<=ate) {
    const anos=Math.min(80,anosCompletosFerias(adm,ate));
    for (let n=0;n<=anos;n++) {
      const inicio=somarAnosFerias(adm,n), fim=deslocarDia(somarAnosFerias(adm,n+1),-1);
      const aq=aquisitivoDe({periodoAquisitivoInicio:diaLocalISO(inicio),periodoAquisitivoFim:diaLocalISO(fim)})!;
      if (!mapa.has(aq.chave)) mapa.set(aq.chave,{...aq,registros:[],direito:30,direitoConfirmado:false,gozados:0,emCurso:0,agendados:0,abono:0,disponivel:30,aConceder:30,pendencias:[],referencia:true});
    }
  }
  return [...mapa.values()].sort((a,b)=>+b.inicio-+a.inicio);
}
export function resumoFeriasPessoa(registros: readonly Ferias[], hoje=new Date()) {
  const periodos=periodosFerias(registros,hoje);
  const semAquisitivo=registros.filter(f=>f.status!=='Cancelada' && !aquisitivoDe(f));
  const incompleto=semAquisitivo.length>0 || periodos.some(p=>p.pendencias.length>0);
  const disponivel=periodos.reduce((s,p)=>s+Math.max(0,p.disponivel),0);
  return {periodos,semAquisitivo,incompleto,disponivel:!periodos.length || incompleto ? null : disponivel,
    agendados:periodos.reduce((s,p)=>s+p.agendados,0),emCurso:periodos.reduce((s,p)=>s+p.emCurso,0),
    referencia:periodos.some(p=>!p.direitoConfirmado),
  };
}

export function validarRegistroFerias(novo: Ferias, todos: readonly Ferias[], hoje=new Date()): string[] {
  const erros:string[]=[];const aq=aquisitivoDe(novo);
  if (!aq) erros.push('Informe as duas datas válidas do aquisitivo, com fim após o início.');
  if (!Number.isInteger(novo.direitoDias) || novo.direitoDias!<0 || novo.direitoDias!>30) erros.push('Confirme o direito deste aquisitivo: de 0 a 30 dias inteiros.');
  if (!Number.isInteger(novo.abonoDias) || novo.abonoDias!<0) erros.push('Informe os dias vendidos como número inteiro; use zero quando não houver abono.');
  if (novo.status==='Cancelada') return []; // Cancelar deve ser possível mesmo com cadastro antigo incompleto.
  const inicio=dataFerias(novo.dataInicio), retorno=dataFerias(novo.dataRetorno);
  if (!!novo.dataInicio !== !!novo.dataRetorno || (novo.dataInicio && (!inicio||!retorno||retorno<=inicio))) erros.push('Informe início e retorno válidos; o retorno é o dia seguinte ao último dia de férias.');
  if (['Agendada','Em andamento'].includes(novo.status) && (!inicio||!retorno)) erros.push('Para agendar, informe início e retorno.');
  if (aq && inicio && inicio<=aq.fim) erros.push('O gozo começa antes de completar o aquisitivo. Confira as datas; antecipações/coletivas exigem análise específica.');
  const outros=todos.filter(f=>f.id!==novo.id && f.colaboradorId===novo.colaboradorId && f.status!=='Cancelada');
  if (inicio && retorno) {
    for (const f of outros) { const i=dataFerias(f.dataInicio), r=dataFerias(f.dataRetorno); if (i&&r&&inicio<r&&i<retorno) {erros.push('As datas coincidem com outro gozo desta pessoa.');break;} }
  }
  const p=periodosFerias([...outros,novo],hoje).find(p=>p.chave===aq?.chave);
  if (p) {
    erros.push(...p.pendencias);
    const fracoes=p.registros.map(duracaoFerias).filter((n):n is number=>n!=null&&n>0);
    if (fracoes.length>3) erros.push('Este aquisitivo já tem três frações. Não é possível criar uma quarta.');
    if ((fracoes.length>1 || p.disponivel>0) && fracoes.some(n=>n<5)) erros.push('Cada fração precisa ter pelo menos cinco dias.');
    const livre=p.disponivel;
    if (fracoes.length && (fracoes.length>1 || livre>0) && Math.max(...fracoes)<14 && (fracoes.length>=3 || livre<14)) erros.push('É necessário preservar uma fração de pelo menos 14 dias; esta divisão não permite isso.');
    if (livre>0 && livre<5 && fracoes.length) erros.push('Esta divisão deixaria menos de cinco dias para uma próxima fração.');
  }
  return [...new Set(erros)];
}

/** Prazos do período completo, incluindo frações já marcadas para depois do limite. */
export function prazoPeriodoFerias(p: PeriodoFerias, hoje=new Date()) {
  const dias=diasDeCalendario(p.limite,hoje);
  const gozoAposLimite=p.registros.some(f=>{const r=dataFerias(f.dataRetorno);return r && deslocarDia(r,-1)>p.limite;});
  const conferir=p.pendencias.length>0 || !p.direitoConfirmado;
  const pendente=p.aConceder>0;
  return {dias,gozoAposLimite,conferir,atencao:pendente && (dias<=60 || gozoAposLimite),
    texto:!pendente ? 'Período utilizado' : gozoAposLimite ? 'Gozo ultrapassa o prazo' : dias<0 ? 'Prazo encerrado: conferir' : dias===0 ? 'Prazo termina hoje' : `Prazo em ${dias} dias`};
}
