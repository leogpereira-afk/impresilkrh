import type { Colaborador, Ponto, PontoDia } from '@/data/types';
import { diaLocalISO, parseData } from './format';

export type JanelaPonto = { inicio: string; fim: string };
export function periodoDoPonto(p: Pick<Ponto, 'competencia' | 'periodoInicio' | 'periodoFim' | 'dias'>): JanelaPonto | null {
  if (parseData(p.periodoInicio) && parseData(p.periodoFim) && p.periodoInicio! <= p.periodoFim!) return { inicio: p.periodoInicio!, fim: p.periodoFim! };
  const datas = (p.dias ?? []).map(d => d.data).filter(d => !!parseData(d)).sort();
  if (datas.length) return { inicio: datas[0], fim: datas[datas.length - 1] };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.competencia)) return null;
  const [ano, mes] = p.competencia.split('-').map(Number);
  return { inicio: `${p.competencia}-01`, fim: diaLocalISO(new Date(ano, mes, 0)) };
}

export function pessoaNoPeriodo(c: Pick<Colaborador, 'dataAdmissao' | 'dataDesligamento'>, periodo: JanelaPonto): boolean {
  return (!c.dataAdmissao || c.dataAdmissao.slice(0, 10) <= periodo.fim)
    && (!c.dataDesligamento || c.dataDesligamento.slice(0, 10) >= periodo.inicio);
}

/** Pausas entre saída e próxima entrada, sem descontar novamente os totais do Secullum. */
export function intervaloDasBatidas(marcacoes: readonly string[] = []): { minutos: number | null; alerta: string | null } {
  if (!marcacoes.length) return { minutos: null, alerta: 'Sem batidas' };
  if (marcacoes.length % 2) return { minutos: null, alerta: 'Batidas incompletas' };
  if (marcacoes.some(h => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(h))) return { minutos: null, alerta: 'Horário inválido' };
  if (marcacoes.length < 4) return { minutos: null, alerta: 'Intervalo não registrado' };
  let dia = 0, anterior = -1;
  const minutos: number[] = [];
  for (const h of marcacoes) {
    const [hh, mm] = h.split(':').map(Number);
    let n = hh * 60 + mm + dia;
    if (n < anterior) { dia += 1440; n += 1440; }
    if (dia > 1440) return { minutos: null, alerta: 'Conferir ordem das batidas' };
    minutos.push(n); anterior = n;
  }
  if (minutos[minutos.length - 1] - minutos[0] >= 1440) return { minutos: null, alerta: 'Conferir ordem das batidas' };
  let soma = 0;
  for (let i = 1; i + 1 < minutos.length; i += 2) soma += minutos[i + 1] - minutos[i];
  return soma > 0 ? { minutos: soma, alerta: null } : { minutos: 0, alerta: 'Intervalo sem duração' };
}

export function janelaDaLeitura(periodo: JanelaPonto, modo: 'dia' | 'semana' | 'periodo', referencia: string): JanelaPonto {
  if (modo === 'periodo') return periodo;
  const d = parseData(referencia) ?? parseData(periodo.fim)!;
  const inicio = new Date(d), fim = new Date(d);
  if (modo === 'semana') { inicio.setDate(d.getDate() - (d.getDay() + 6) % 7); fim.setTime(inicio.getTime()); fim.setDate(inicio.getDate() + 6); }
  return { inicio: diaLocalISO(inicio), fim: diaLocalISO(fim) };
}

export function leituraDoPonto(pontos: readonly Ponto[], janela: JanelaPonto, hoje = diaLocalISO()) {
  const mapa = new Map<string, { data: string; normais: number; extras: number; faltas: number; registros: number; lacunas: number; alertas: number }>();
  const pessoas = pontos.map(p => {
    const periodo = periodoDoPonto(p);
    const inicio = periodo ? [periodo.inicio, janela.inicio].sort()[1] : janela.inicio;
    const fim = periodo ? [periodo.fim, janela.fim, hoje].sort()[0] : [janela.fim, hoje].sort()[0];
    const registros = new Map<string, PontoDia>();
    let duplicados = 0;
    for (const d of p.dias ?? []) {
      if (d.data < inicio || d.data > fim) continue;
      if (registros.has(d.data)) duplicados++;
      else registros.set(d.data, d);
    }
    let informados = 0;
    let normais = 0, extras = 0, faltas = 0, lacunas = 0, alertas = 0, intervalo = 0;
    const cursor = parseData(inicio);
    for (let i = 0; cursor && diaLocalISO(cursor) <= fim && i < 370; i++, cursor.setDate(cursor.getDate() + 1)) {
      const data = diaLocalISO(cursor), d = registros.get(data);
      const dia = mapa.get(data) ?? { data, normais: 0, extras: 0, faltas: 0, registros: 0, lacunas: 0, alertas: 0 };
      if (!d || d.situacao === 'semRegistro') { lacunas++; dia.lacunas++; }
      else {
        informados++;
        const n = Number.isFinite(d.normaisMin) ? d.normaisMin : 0;
        const e = Number.isFinite(d.extrasMin) ? d.extrasMin : 0;
        const f = Number.isFinite(d.faltasMin) ? d.faltasMin : 0;
        normais += n; extras += e; faltas += f;
        dia.normais += n; dia.extras += e; dia.faltas += f; dia.registros++;
        if (d.situacao === 'normal' || (d.marcacoes?.length ?? 0) > 0) {
          const pausa = intervaloDasBatidas(d.marcacoes);
          if (pausa.alerta) { alertas++; dia.alertas++; }
          intervalo += pausa.minutos ?? 0;
        }
      }
      mapa.set(data, dia);
    }
    return { ponto: p, normais, extras, faltas, intervalo, lacunas, alertas, duplicados, registros: informados };
  });
  return { pessoas, dias: [...mapa.values()].sort((a, b) => a.data.localeCompare(b.data)) };
}

export function confereSomaDias(p: Ponto): { ok: boolean; difNormais: number; difExtras: number; difFaltas: number } | null {
  if (!p.dias?.length) return null;
  const difNormais = p.dias.reduce((s, x) => s + (x.normaisMin || 0), 0) - (p.normaisMin || 0);
  const somaExtras = p.dias.reduce((s, x) => s + (x.extrasMin || 0), 0);
  const somaFaltas = p.dias.reduce((s, x) => s + (x.faltasMin || 0), 0);
  const difExtras = somaExtras - (p.extrasMin || 0);
  const difFaltas = somaFaltas - (p.faltasMin || 0);
  // 1 minuto de tolerância: o Secullum arredonda ao imprimir.
  return { ok: Math.abs(difNormais) <= 1 && Math.abs(difExtras) <= 1 && Math.abs(difFaltas) <= 1, difNormais, difExtras, difFaltas };
}
