import { describe, expect, it } from 'vitest';
import type { Colaborador, Pagamento } from '@/data/types';
import { conciliarDoRh, linhasDoRh, paraRegistrosDoRh } from './foraRh';
import type { LinhaMubi } from './mubiPagamentos';
import { diffAplicavel } from './previaFolha';

const linha = (idMubi: string, nome = 'COLABORADORES'): LinhaMubi => ({
  idMubi, nome, ehColaborador: true, cpfCnpj: null, planoContas: '2.1.1-Salário',
  tipo: 'Salário', descricao: '', valor: 100, dataVencimento: '2026-07-05',
  dataPagamento: '2026-07-05', status: 'Pago', formaPagamento: 'PIX', centroCusto: '',
});
const pessoa = { id: 'p1', nome: 'Maria da Silva' } as Colaborador;
const pagamento = (id: string, idMubi?: string): Pagamento => ({
  id, idMubi, colaboradorId: 'p1', competencia: '2026-06', tipo: 'Salário', valor: 100,
} as Pagamento);

describe('decisão explícita fora do RH', () => {
  it('filtra só o ID escolhido, nunca o nome nem o grupo coletivo', () => {
    const linhas = [linha('1'), linha('2'), linha('3', '')];
    expect(linhasDoRh(linhas, ['1']).map(l => l.idMubi)).toEqual(['2', '3']);
    expect(linhasDoRh(linhas)).toEqual(linhas);
    expect(linhas).toHaveLength(3);
  });
  it('persiste apenas IDs e desfazer devolve o título não encontrado', () => {
    const linhas = [linha('1', 'Pessoa desconhecida'), linha('2', 'Pessoa desconhecida')];
    const ids = JSON.parse(JSON.stringify(['1']));
    const previa = paraRegistrosDoRh(linhas, [], {}, {}, ids);
    expect(previa.naoCasados.flatMap(n => n.titulos.map(t => t.idMubi))).toEqual(['2']);
    expect(paraRegistrosDoRh(linhas, [], {}, {}, []).naoCasados[0].titulos).toHaveLength(2);
  });
  it('impede importar mesmo se houver vínculo salvo ou nome correspondente', () => {
    const previa = paraRegistrosDoRh([linha('1', pessoa.nome)], [pessoa], {}, { '1': pessoa.id }, ['1']);
    expect(previa.registros).toEqual([]);
    expect(previa.cpfsAprendidos).toEqual([]);
    expect(paraRegistrosDoRh([linha('1', pessoa.nome)], [pessoa], {}, {}, []).registros).toHaveLength(1);
  });
  it('preserva registros existentes sem gerar sumidos ou remoções, inclusive ID legado', () => {
    const existentes = [pagamento('adotado', '1'), pagamento('mubi-2'), pagamento('mubi-3')];
    const antes = structuredClone(existentes);
    const diff = conciliarDoRh(existentes, [], new Set(['2026-06']), ['1', '2']);
    expect(diff.ausentes.map(p => p.id)).toEqual(['mubi-3']);
    expect(diffAplicavel(diff, new Set()).ausentes.map(p => p.id)).toEqual(['mubi-3']);
    expect(existentes).toEqual(antes);
    expect(conciliarDoRh(existentes, [], new Set(['2026-06']), []).ausentes).toHaveLength(3);
  });
  it('mantém outros títulos na importação e filtra também o lado novo do diff', () => {
    const novos = [pagamento('mubi-1'), pagamento('mubi-2')];
    const diff = conciliarDoRh([], novos, new Set(['2026-06']), ['1']);
    expect(diff.novos.map(p => p.id)).toEqual(['mubi-2']);
  });
});
