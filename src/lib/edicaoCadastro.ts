import type { Colaborador } from '@/data/types';
import { diaLocalISO, parseData } from './format';

/** Conferência apenas dos campos editados: um dado legado não impede corrigir outro. */
export function erroDatasCadastro(dados: Partial<Colaborador>, antes?: Partial<Colaborador> | null, hoje = new Date()): string | null {
  const campos = ['dataNascimento', 'dataAdmissao', 'dataDesligamento', 'dataInicioCargo'] as const;
  for (const campo of campos) {
    if (dados[campo] && dados[campo] !== antes?.[campo] && !parseData(dados[campo])) return 'Confira a data informada: esse dia não existe.';
  }
  const nascimento = dados.dataNascimento?.slice(0, 10);
  if (nascimento && nascimento !== antes?.dataNascimento?.slice(0, 10) && nascimento > diaLocalISO(hoje)) return 'A data de nascimento não pode estar no futuro.';
  if (nascimento && dados.dataAdmissao && (dados.dataNascimento !== antes?.dataNascimento || dados.dataAdmissao !== antes?.dataAdmissao) && nascimento > dados.dataAdmissao.slice(0, 10)) return 'A admissão não pode ser anterior ao nascimento.';
  if (dados.dataAdmissao && dados.dataDesligamento && (dados.dataAdmissao !== antes?.dataAdmissao || dados.dataDesligamento !== antes?.dataDesligamento) && dados.dataDesligamento.slice(0, 10) < dados.dataAdmissao.slice(0, 10)) return 'O desligamento não pode ser anterior à admissão.';
  const inicio = dados.dataInicioCargo?.slice(0, 10);
  if (inicio && dados.dataInicioCargo !== antes?.dataInicioCargo && inicio > diaLocalISO(hoje)) return 'O início no cargo não pode estar no futuro.';
  if (inicio && dados.dataAdmissao && (dados.dataInicioCargo !== antes?.dataInicioCargo || dados.dataAdmissao !== antes?.dataAdmissao) && inicio < dados.dataAdmissao.slice(0, 10)) return 'O início no cargo não pode ser anterior à admissão.';
  if (inicio && dados.dataDesligamento && (dados.dataInicioCargo !== antes?.dataInicioCargo || dados.dataDesligamento !== antes?.dataDesligamento) && inicio > dados.dataDesligamento.slice(0, 10)) return 'O início no cargo não pode ser posterior ao desligamento.';
  return null;
}

/** Valida só contatos alterados, preservando cadastros legados ao corrigir outro campo. */
export function erroContatosCadastro(dados: Partial<Colaborador>, antes?: Partial<Colaborador> | null): string | null {
  const telefones = [
    ['Telefone', dados.telefone, antes?.telefone],
    ['Telefone do cônjuge', dados.conjugeTelefone, antes?.conjugeTelefone],
    ['Telefone de emergência', dados.contatoEmergencia?.telefone, antes?.contatoEmergencia?.telefone],
  ];
  for (const [nome, valor, anterior] of telefones) {
    if (!valor?.trim() || valor === anterior) continue;
    const digitos = valor.replace(/\D/g, '');
    const internacional = valor.trim().startsWith('+');
    if (!/^\+?[\d\s().-]+$/.test(valor.trim()) || (internacional ? digitos.length < 7 || digitos.length > 15 : ![10, 11].includes(digitos.length) && !(/^55/.test(digitos) && [12, 13].includes(digitos.length)))) {
      return `${nome}: informe DDD e número. Para outro país, comece com + e o código do país.`;
    }
  }
  if (dados.enderecoCep?.trim() && dados.enderecoCep !== antes?.enderecoCep && !/^\d{5}-?\d{3}$/.test(dados.enderecoCep.trim())) return 'CEP: informe 8 dígitos, como 00000-000.';
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
