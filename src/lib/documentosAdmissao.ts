import type { Colaborador, Tarefa } from '@/data/types';

export const PREFIXO_DOC = 'Doc: ';
export const DOCS_RH_PADRAO = ['Contrato assinado', 'RG/CPF/CTPS', 'Comprovante de residência', 'Dados bancários', 'ASO admissional', 'Foto 3x4', 'Termo do Código de Ética'];

/** Apenas propõe. A tela exibe a lista e aplica somente pessoas selecionadas. */
export function proporDocumentosAdmissao(pessoas: readonly Pick<Colaborador, 'id' | 'nome' | 'docsRhSemeadosEm'>[], tarefas: readonly Tarefa[]) {
  return pessoas.flatMap(p => {
    if (p.docsRhSemeadosEm) return [];
    const admissao = tarefas.filter(t => t.colaboradorId === p.id && t.tipo === 'Admissão');
    if (!admissao.length) return [];
    const existentes = admissao.filter(t => t.titulo.startsWith(PREFIXO_DOC));
    const ordem = Math.max(-1, ...admissao.map(t => t.ordem)) + 1;
    const novas: Tarefa[] = existentes.length ? [] : DOCS_RH_PADRAO.map((nome, i) => ({
      id: `tar-doc-${p.id}-${i}`, colaboradorId: p.id, tipo: 'Admissão', titulo: `${PREFIXO_DOC}${nome}`,
      responsavel: 'RH', concluida: false, concluidaEm: null, ordem: ordem + i,
    }));
    return [{ colaboradorId: p.id, nome: p.nome, existentes: existentes.length, novas }];
  });
}
