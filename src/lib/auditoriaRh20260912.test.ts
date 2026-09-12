import { describe, expect, it, vi } from 'vitest';
import type { Aceite, CicloAvaliacao, Colaborador, Ponto } from '@/data/types';
import { parseData } from './format';
import { cicloVigente } from './cicloVigente';
import { camposEmConflito, erroDatasCadastro, quantidadeFilhos } from './edicaoCadastro';
import { patchDoQueMudou } from './patchDoQueMudou';
import { confereSomaDias, periodoDoPonto, pessoaNoPeriodo, intervaloDasBatidas, janelaDaLeitura, leituraDoPonto } from './leituraPonto';
import { situacaoValidade } from './validadeDocumento';
import { aceiteDaVersao } from './aceiteVersao';
import { dependentesArea, dependentesCargo } from './dependenciasEstrutura';
import { abrirAnexoEmNovaAba } from './abrirArquivo';
import { pagamentoNaFolhaReal } from './folhaRelatorio';
import { movimentacaoPeriodo } from './movimentacaoPeriodo';
import { ganhosAlemDoSalario } from './dossieFeedback';

const hoje = new Date(2026, 8, 12, 15);
const ciclo = (id: string, dataInicio: string, status = 'Fechado') => ({ id, dataInicio, status } as CicloAvaliacao);
const ponto: Ponto = { id: 'teste', colaboradorId: 'ana', competencia: '2026-09', nomePdf: 'Pessoa de teste', periodoInicio: '2026-08-29', periodoFim: '2026-09-28', normaisMin: 1080, extrasMin: 30, faltasMin: 0, importadoEm: '', atualizadoEm: '', dias: [
  { data: '2026-09-10', situacao: 'normal', normaisMin: 540, extrasMin: 30, faltasMin: 0, marcacoes: ['07:00','12:00','13:00','17:30'] },
  { data: '2026-09-11', situacao: 'normal', normaisMin: 540, extrasMin: 0, faltasMin: 0, marcacoes: ['07:00','16:00'] },
] };

describe('auditoria — datas e ciclos', () => {
  it.each(['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-09-00'])('recusa dia inexistente %s', data => expect(parseData(data)).toBeNull());
  it('mantém bissexto e dia local', () => { expect(parseData('2024-02-29')?.getDate()).toBe(29); expect(parseData('2026-09-01')?.getMonth()).toBe(8); });
  it('seleciona ciclo aberto mais recente sem alterar a coleção', () => { const lista = [ciclo('antigo','2025-01-01','Aberto'),ciclo('atual','2026-01-01','Aberto')]; expect(cicloVigente(lista)?.id).toBe('atual'); expect(lista[0].id).toBe('antigo'); });
  it('na ausência de aberto usa o recente em todas as telas', () => expect(cicloVigente([ciclo('a','2025-01-01'),ciclo('b','2026-01-01')])?.id).toBe('b'));
  it('coleção vazia não inventa um ciclo', () => expect(cicloVigente([])).toBeUndefined());
});

describe('auditoria — edição de cadastro', () => {
  it('preserva telefone atualizado em outro acesso ao editar só o nome', () => {
    const antes = { nome:'Ana', telefone:'111', qtdFilhos:2 }, atual = { ...antes, telefone:'222' };
    const patch = patchDoQueMudou(antes, { ...antes, nome:'Ana Maria' });
    expect(camposEmConflito(antes, atual, patch)).toEqual([]);
    expect({ ...atual, ...patch }).toEqual({ nome:'Ana Maria', telefone:'222', qtdFilhos:2 });
  });
  it('detecta conflito no mesmo campo sem depender de revisão', () => expect(camposEmConflito({nome:'Ana'}, {nome:'Ana Silva'}, {nome:'Ana Maria'})).toEqual(['nome']));
  it('o mesmo valor recebido não é conflito', () => expect(camposEmConflito({nome:'Ana'}, {nome:'Ana Maria'}, {nome:'Ana Maria'})).toEqual([]));
  it('recusa nascimento futuro', () => expect(erroDatasCadastro({dataNascimento:'2027-01-01'}, null, hoje)).toContain('futuro'));
  it('recusa desligamento antes da admissão', () => expect(erroDatasCadastro({dataAdmissao:'2026-02-01',dataDesligamento:'2026-01-01'}, null, hoje)).toContain('desligamento'));
  it('não impede correção de telefone por inconsistência antiga de data', () => { const antes = {dataAdmissao:'2026-02-01',dataDesligamento:'2026-01-01'}; expect(erroDatasCadastro({...antes,telefone:'222'}, antes, hoje)).toBeNull(); });
});

describe('auditoria — ponto e intervalos', () => {
  it.each([
    { nome: 'dia zerado importado como normal', normaisMin: 0, extrasMin: 0, faltasMin: 0, marcacoes: [], alertas: 0 },
    { nome: 'falta integral sem trabalho', normaisMin: 0, extrasMin: 0, faltasMin: 540, marcacoes: [], alertas: 0 },
    { nome: 'marcador Folga do PDF não é batida', normaisMin: 0, extrasMin: 0, faltasMin: 0, marcacoes: ['Folga'], alertas: 0 },
    { nome: 'marcador Atestado do PDF não é batida', normaisMin: 0, extrasMin: 0, faltasMin: 0, marcacoes: ['Atestado'], alertas: 0 },
    { nome: 'horas normais sem batidas', normaisMin: 540, extrasMin: 0, faltasMin: 0, marcacoes: [], alertas: 1 },
    { nome: 'somente horas extras sem batidas', normaisMin: 0, extrasMin: 60, faltasMin: 0, marcacoes: [], alertas: 1 },
    { nome: 'batida incompleta ainda sem horas', normaisMin: 0, extrasMin: 0, faltasMin: 0, marcacoes: ['07:00'], alertas: 1 },
  ])('alerta de intervalo respeita evidência de trabalho: $nome', ({ normaisMin, extrasMin, faltasMin, marcacoes, alertas }) => {
    const p = { ...ponto, dias: [{ data: '2026-09-12', situacao: 'normal' as const, normaisMin, extrasMin, faltasMin, marcacoes }] };
    expect(leituraDoPonto([p], { inicio: '2026-09-12', fim: '2026-09-12' }, '2026-09-12').pessoas[0]).toMatchObject({ normais: normaisMin, extras: extrasMin, faltas: faltasMin, alertas, lacunas: 0 });
  });
  it('o período é o do PDF, não o corte fixo 16 a 15', () => { expect(periodoDoPonto(ponto)).toEqual({inicio:'2026-08-29',fim:'2026-09-28'}); expect(pessoaNoPeriodo({dataAdmissao:'2026-09-20'} as Colaborador, periodoDoPonto(ponto)!)).toBe(true); });
  it('admitido após o período não é cobrado', () => expect(pessoaNoPeriodo({dataAdmissao:'2026-09-29'} as Colaborador, periodoDoPonto(ponto)!)).toBe(false));
  it('usa dias informados quando não há cabeçalho do PDF', () => expect(periodoDoPonto({...ponto,periodoInicio:null,periodoFim:null})).toEqual({inicio:'2026-09-10',fim:'2026-09-11'}));
  it('soma só as pausas entre saída e entrada', () => expect(intervaloDasBatidas(['07:00','12:00','13:00','17:00']).minutos).toBe(60));
  it('separa situação e horários na coluna mista do Secullum', () => expect(intervaloDasBatidas(['Feriado','07:00','12:00','13:00','17:00'])).toEqual({ minutos: 60, alerta: null }));
  it('aceita hora com um dígito, como o importador e o extrato', () => expect(intervaloDasBatidas(['7:00','12:00','13:00','17:00'])).toEqual({ minutos: 60, alerta: null }));
  it('suporta virada da noite', () => expect(intervaloDasBatidas(['22:00','02:00','03:00','07:00']).minutos).toBe(60));
  it('soma mais de um intervalo', () => expect(intervaloDasBatidas(['07:00','09:00','09:15','12:00','13:00','17:00']).minutos).toBe(75));
  it.each([['07:00','17:00'],['07:00','12:00','13:00'],['07:00','25:00','13:00','17:00']])('sinaliza batidas incompletas/intervalo ausente: %j', (...marcacoes) => expect(intervaloDasBatidas(marcacoes)).toMatchObject({minutos:null,alerta:expect.any(String)}));
  it('sem batida de folga não inventa problema nem falta', () => { const p = {...ponto,dias:[{data:'2026-09-12',situacao:'folga' as const,normaisMin:0,extrasMin:0,faltasMin:0}]}; const r = leituraDoPonto([p],{inicio:'2026-09-12',fim:'2026-09-12'},'2026-09-12'); expect(r.pessoas[0]).toMatchObject({faltas:0,alertas:0,lacunas:0}); });
  it('não desconta o intervalo uma segunda vez dos totais do Secullum', () => { const r = leituraDoPonto([ponto],{inicio:'2026-09-10',fim:'2026-09-11'},'2026-09-12'); expect(r.pessoas[0]).toMatchObject({normais:1080,extras:30,intervalo:60,alertas:1,lacunas:0}); });
  it('lacuna não vira falta e dias futuros não são cobrados', () => { const r=leituraDoPonto([ponto],{inicio:'2026-09-10',fim:'2026-09-28'},'2026-09-12'); expect(r.pessoas[0]).toMatchObject({lacunas:1,faltas:0}); expect(r.dias.map(d=>d.data)).toEqual(['2026-09-10','2026-09-11','2026-09-12']); });
  it('duplicidade de dia é sinalizada sem duplicar horas na leitura', () => { const r=leituraDoPonto([{...ponto,dias:[ponto.dias![0],ponto.dias![0]]}],{inicio:'2026-09-10',fim:'2026-09-10'},'2026-09-12'); expect(r.pessoas[0]).toMatchObject({normais:540,duplicados:1}); });
  it('semana cruza mês e começa na segunda', () => expect(janelaDaLeitura({inicio:'2026-08-29',fim:'2026-09-28'},'semana','2026-09-01')).toEqual({inicio:'2026-08-31',fim:'2026-09-06'}));
});

describe('auditoria — informação confiável', () => {
  it.each([undefined, null, '', '2026-02-30'])('exame sem prazo válido não ganha selo válido (%s)', data => expect(situacaoValidade(data, hoje)).toBe('Sem validade informada'));
  it('vence hoje continua a vencer, não vencido', () => expect(situacaoValidade('2026-09-12', hoje)).toBe('A vencer'));
  it('aceite de versão anterior não confirma a atual', () => { const a = {id:'a',colaboradorId:'ana',tipo:'Código de Ética',versao:'1',criadoEm:'2026-01-01'} as Aceite; expect(aceiteDaVersao([a],'ana','Código de Ética','2')).toBeUndefined(); expect(aceiteDaVersao([a],'ana','Código de Ética','1')).toBe(a); });
  it('dossiê não apresenta pendências nem encargos como ganhos do empregado', () => {
    const pg=(tipo:string,valor:number,statusErp='PAGO')=>({colaboradorId:'ana',competencia:'2026-09',tipo,valor,statusErp});
    const r=ganhosAlemDoSalario([pg('Horas Extras',100),pg('Horas Extras',900,'PENDENTE'),pg('FGTS',200),pg('INSS',300)],'ana',hoje);
    expect(r.total).toBe(100);
    expect(r.porTipo).toEqual([{tipo:'Horas Extras',valor:100}]);
  });
});


describe('conferência completa do ponto', () => {
  it('detecta divergência nas horas normais mesmo com extras e faltas corretas', () => expect(confereSomaDias({...ponto,normaisMin:1620})?.ok).toBe(false));
  it('confirma quando os três totais fecham', () => expect(confereSomaDias(ponto)?.ok).toBe(true));
  it('sem detalhe não afirma conferência', () => expect(confereSomaDias({...ponto,dias:[]})).toBeNull());
});


describe('vínculos e anexos', () => {
  it('protege referências históricas e vagas ao excluir cargo', () => {
    expect(dependentesCargo('c', [{cargoId:'c'}, {cargoId:'outro'}], [{cargoId:'c'}])).toBe(2);
    expect(dependentesArea('a', [], [], [{areaId:'a'}], [{areaId:'a'}])).toBe(2);
  });
  it('abre a janela durante o clique e trata título como texto', async () => {
    const write=vi.fn(), fechar=vi.fn();
    const janela={opener:window,document:{write,open:vi.fn(),close:vi.fn()},close:fechar};
    const open=vi.spyOn(window,'open').mockReturnValue(janela as unknown as Window);
    try {
      const carregar=vi.fn(async()=> { expect(open).toHaveBeenCalledOnce(); return 'data:application/pdf;base64,JVBERg=='; });
      await abrirAnexoEmNovaAba(carregar,vi.fn(),'</title><script>alert(1)</script>');
      expect(write.mock.calls.join('')).not.toContain('<script>');
      expect(write.mock.calls.join('')).toContain('&lt;script&gt;');
      expect(janela.opener).toBeNull(); expect(fechar).not.toHaveBeenCalled();
    } finally { open.mockRestore(); }
  });
  it('informa bloqueio de popup sem baixar um arquivo inutilmente', async () => {
    const open=vi.spyOn(window,'open').mockReturnValue(null), carregar=vi.fn(), avisar=vi.fn();
    try { await abrirAnexoEmNovaAba(carregar,avisar); expect(carregar).not.toHaveBeenCalled(); expect(avisar).toHaveBeenCalledWith(expect.stringContaining('bloqueou')); } finally { open.mockRestore(); }
  });
});


it('relatório não mistura pagamento pendente com folha paga, nem por competência', () => {
  const ids=new Set(['ana']);
  expect(pagamentoNaFolhaReal({colaboradorId:'ana',tipo:'Salário',statusErp:'PENDENTE'},ids)).toBe(false);
  expect(pagamentoNaFolhaReal({colaboradorId:'ana',tipo:'Salário',statusErp:'PAGO'},ids)).toBe(true);
  expect(pagamentoNaFolhaReal({colaboradorId:'ana',tipo:'FGTS',statusErp:'PAGO'},ids)).toBe(false);
});


it('a lista vazia de nomes não apaga a quantidade de filhos anterior', () => {
  expect(quantidadeFilhos({filhos:[],qtdFilhos:2})).toBe(2);
  expect(quantidadeFilhos({filhos:[],qtdFilhos:0})).toBe(0);
  expect(quantidadeFilhos({})).toBeNull();
});


it('relatório histórico usa o quadro da época e exclui admissões futuras', () => {
  const pessoas=[{dataAdmissao:'2025-01-01'},{dataAdmissao:'2025-01-01',dataDesligamento:'2026-02-15',statusId:'inativo'},{dataAdmissao:'2026-11-01'}] as Colaborador[];
  const r=movimentacaoPeriodo(pessoas,2026,2,hoje);
  expect(r).toMatchObject({abertura:2,fechamento:1,incompletos:0}); expect(r.turnover).toBeCloseTo(1/1.5);
  expect(r.admit).toHaveLength(0);
  expect(movimentacaoPeriodo([{} as Colaborador],2026,2,hoje).turnover).toBeNull();
  const comHorario = movimentacaoPeriodo([{dataAdmissao:'2026-02-28T12:00:00Z'}] as Colaborador[],2026,2,hoje);
  expect(comHorario).toMatchObject({abertura:0,fechamento:1});
});
