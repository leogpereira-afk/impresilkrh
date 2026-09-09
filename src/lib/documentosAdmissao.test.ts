import { expect, it } from 'vitest';
import { proporDocumentosAdmissao } from './documentosAdmissao';
import type { Tarefa } from '@/data/types';
const tarefa = (colaboradorId: string, titulo = 'Apresentação', tipo = 'Admissão'): Tarefa => ({ id: `t-${colaboradorId}`, colaboradorId, titulo, tipo, ordem: 4, concluida: true });
it('propõe documentos só para admissão no escopo, preservando itens existentes e exclusões anteriores', () => {
  const pessoas = [{id:'nova',nome:'Nova'}, {id:'antiga',nome:'Antiga'}, {id:'limpa',nome:'Limpa',docsRhSemeadosEm:'2026-01-01'}, {id:'sem',nome:'Sem admissão'}, {id:'saida',nome:'Saída'}];
  const tarefas = [tarefa('nova'),tarefa('antiga','Doc: Contrato assinado'),tarefa('limpa'),tarefa('fora'),tarefa('saida','Encerrar','Desligamento')];
  const antes = JSON.stringify({pessoas,tarefas});
  const plano = proporDocumentosAdmissao(pessoas,tarefas);
  expect(plano.map(p => p.colaboradorId)).toEqual(['nova','antiga']);
  expect(plano[0].novas).toHaveLength(7);
  expect(plano[0].novas[0]).toMatchObject({id:'tar-doc-nova-0',ordem:5,concluida:false});
  expect(plano[1]).toMatchObject({existentes:1,novas:[]});
  expect(proporDocumentosAdmissao(pessoas,tarefas)).toEqual(plano);
  expect(JSON.stringify({pessoas,tarefas})).toBe(antes);
});
