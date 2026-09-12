import type { Colaborador } from '@/data/types';
import { diaLocalISO, parseData } from './format';

/** Conferência apenas dos campos editados: um dado legado não impede corrigir outro. */
export function erroDatasCadastro(dados: Partial<Colaborador>, antes?: Partial<Colaborador> | null, hoje = new Date()): string | null {
  const campos = ['dataNascimento', 'dataAdmissao', 'dataDesligamento'] as const;
  for (const campo of campos) {
    if (dados[campo] && dados[campo] !== antes?.[campo] && !parseData(dados[campo])) return 'Confira a data informada: esse dia não existe.';
  }
  const nascimento = dados.dataNascimento?.slice(0, 10);
  if (nascimento && nascimento !== antes?.dataNascimento?.slice(0, 10) && nascimento > diaLocalISO(hoje)) return 'A data de nascimento não pode estar no futuro.';
  if (nascimento && dados.dataAdmissao && (dados.dataNascimento !== antes?.dataNascimento || dados.dataAdmissao !== antes?.dataAdmissao) && nascimento > dados.dataAdmissao.slice(0, 10)) return 'A admissão não pode ser anterior ao nascimento.';
  if (dados.dataAdmissao && dados.dataDesligamento && (dados.dataAdmissao !== antes?.dataAdmissao || dados.dataDesligamento !== antes?.dataDesligamento) && dados.dataDesligamento.slice(0, 10) < dados.dataAdmissao.slice(0, 10)) return 'O desligamento não pode ser anterior à admissão.';
  return null;
}

/** Não depende de revisão: protege também cadastros legados contra edições concorrentes. */
export function camposEmConflito(antes: object, atual: object, patch: object): string[] {
  const a = antes as Record<string, unknown>, b = atual as Record<string, unknown>, p = patch as Record<string, unknown>;
  const igual = (x: unknown, y: unknown) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);
  return Object.keys(p).filter(k => !igual(a[k], b[k]) && !igual(b[k], p[k]));
}


export function quantidadeFilhos(c: Pick<Colaborador, 'filhos' | 'qtdFilhos'>): number | null {
  const informado = Number.isInteger(c.qtdFilhos) && c.qtdFilhos! >= 0 ? c.qtdFilhos! : null;
  if (c.filhos?.length) return Math.max(c.filhos.length, informado ?? 0);
  return informado ?? (c.filhos ? 0 : null);
}
