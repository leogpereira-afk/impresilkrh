import type { Colaborador } from '@/data/types';
import { diaLocalISO, parseData } from './format';

/** Reconstrói o quadro pelas datas do período, sem usar o quadro de hoje como passado. */
export function movimentacaoPeriodo(pessoas: readonly Colaborador[], ano: number, mes: number, hoje = new Date()) {
  const inicio = diaLocalISO(new Date(ano, mes ? mes - 1 : 0, 1));
  const fim = [diaLocalISO(new Date(ano, mes || 12, 0)), diaLocalISO(hoje)].sort()[0];
  const base = pessoas.filter(c => !c.ehDirecao);
  const dentro = (v?: string | null) => !!parseData(v) && v!.slice(0, 10) >= inicio && v!.slice(0, 10) <= fim;
  const admit = base.filter(c => dentro(c.dataAdmissao)), deslig = base.filter(c => dentro(c.dataDesligamento));
  const incompletos = base.filter(c => !parseData(c.dataAdmissao) || (c.statusId === 'inativo' && !parseData(c.dataDesligamento)) || (c.dataDesligamento && (!parseData(c.dataDesligamento) || c.dataDesligamento < c.dataAdmissao!)));
  const validos = base.filter(c => !incompletos.includes(c));
  const abertura = validos.filter(c => c.dataAdmissao!.slice(0, 10) < inicio && (!c.dataDesligamento || c.dataDesligamento.slice(0, 10) >= inicio)).length;
  const fechamento = validos.filter(c => c.dataAdmissao!.slice(0, 10) <= fim && (!c.dataDesligamento || c.dataDesligamento.slice(0, 10) > fim)).length;
  const media = (abertura + fechamento) / 2;
  return {admit, deslig, saldo:admit.length - deslig.length, abertura, fechamento, incompletos:incompletos.length,
    turnover: inicio > fim || incompletos.length || !media ? null : deslig.length / media};
}
