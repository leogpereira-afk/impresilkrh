// Auditoria campo por campo com fichas fictícias e rede bloqueada.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const acesso = vi.hoisted(() => ({ perfil: 'ADMIN_RH', conferindoAcesso: false }));
vi.mock('@/lib/session', () => ({ useSessao: () => ({ ...acesso, colaboradorId: 'admin-teste', id: 'usuario-ficticio' }), obterSessao: () => ({ ...acesso, colaboradorId: 'admin-teste', id: 'usuario-ficticio' }) }));
vi.mock('@/lib/sync', () => ({ enviarArquivoNuvem: vi.fn(), buscarArquivoNuvem: vi.fn(), enviarColecao: vi.fn(), enviarConfigNuvem: vi.fn(), apagarRegistrosNuvem: vi.fn() }));
vi.mock('@/components/charts/charts', () => ({ BarrasVerticais: () => null }));
import ColaboradorFicha, { AbaDados } from './ColaboradorFicha';
import { ColaboradorForm } from '@/components/colaboradores/colaborador-form';
import { ToastProvider } from '@/components/ui/toast';
import { NOMES_COLECOES } from '@/data';
import type { Colaborador } from '@/data/types';
import { definirColecao, obter, registrarMutacao } from '@/lib/store';
import { lerLocal } from '@/lib/armazenamentoUsuario';
import { useDominio } from '@/lib/dominio';
import { enviarColecao, apagarRegistrosNuvem } from '@/lib/sync';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let el: HTMLDivElement, root: Root;
const mutacao = vi.fn();
const base: Colaborador = {
  id: 'pessoa-ficticia', nome: 'Pessoa Fictícia', idPessoa: '000001', cpf: '52998224725', apelido: 'ficticia',
  statusId: 'ativo', dataNascimento: '1990-01-01', dataAdmissao: '2020-01-01', dataInicioCargo: '2021-01-01',
  email: 'teste@example.invalid', telefone: '(00) 90000-0000', enderecoRua: 'Rua de Teste', enderecoNumero: '1',
  enderecoComplemento: 'Bloco Fictício', enderecoBairro: 'Bairro Fictício', enderecoCep: '00000-000', cidade: 'Cidade de Teste',
  conjugeNome: 'Cônjuge Fictício', conjugeTelefone: '(00) 90000-0001', qtdFilhos: 2,
  filhos: [{ nome: 'Dependente Fictício', nascimento: '2015-01-01' }],
  contatoEmergencia: { nome: 'Contato Fictício', parentesco: 'Familiar', telefone: '(00) 90000-0002' },
  cargoId: 'cargo-a', areaId: 'area-a', nivelId: 'N1', salario: 2000, matriculaEsocial: 'M-TESTE', valeTransporte: false,
  camisaModelo: 'Masculina', camisaTamanho: 'P', calcaTamanho: '38', botaNumero: '38',
  riscoSaida: 'Baixo', cnh: 'B', humor: 'Estável', estiloAprendizagem: 'Visual', empresa: 'Impresilk', sexo: 'Feminino',
  setor: 'Setor de Teste', subarea: 'Subárea de Teste', funcao: 'Função legada fictícia', cargoLivre: 'Cargo livre fictício',
  adicionais: 10, observacaoEnquadramento: 'Observação fictícia', pontosFortes: 'Ponto forte fictício',
};
const campos = [
  ['CPF', '11144477735', 'cpf', '11144477735'],
  ['Apelido (login)', 'Fictício Novo', 'apelido', 'ficticionovo'],
  ['Nascimento', '1991-02-02', 'dataNascimento', '1991-02-02'],
  ['E-mail', ' novo@example.invalid ', 'email', 'novo@example.invalid'],
  ['Telefone', '(00) 90000-0003', 'telefone', '(00) 90000-0003'],
  ['Endereço (rua)', ' Rua Nova ', 'enderecoRua', 'Rua Nova'],
  ['Número', 'S/N', 'enderecoNumero', 'S/N'],
  ['Complemento', 'Apto Fictício', 'enderecoComplemento', 'Apto Fictício'],
  ['Bairro', 'Novo Bairro', 'enderecoBairro', 'Novo Bairro'],
  ['Cidade', 'Nova Cidade', 'cidade', 'Nova Cidade'],
  ['CEP', '00000-001', 'enderecoCep', '00000-001'],
  ['Cônjuge', 'Outro Cônjuge Fictício', 'conjugeNome', 'Outro Cônjuge Fictício'],
  ['Telefone do cônjuge', '(00) 90000-0004', 'conjugeTelefone', '(00) 90000-0004'],
  ['Camisa (modelo)', 'Baby look', 'camisaModelo', 'Baby look'],
  ['Camisa (tamanho)', 'M', 'camisaTamanho', 'M'],
  ['Calça', '42', 'calcaTamanho', '42'],
  ['Bota (número)', '40', 'botaNumero', '40'],
  ['Nome do contato', 'Novo Contato Fictício', 'contatoEmergencia.nome', 'Novo Contato Fictício'],
  ['Parentesco', 'Irmã', 'contatoEmergencia.parentesco', 'Irmã'],
  ['Telefone de emergência', '(00) 90000-0005', 'contatoEmergencia.telefone', '(00) 90000-0005'],
  ['Cargo', 'cargo-b', 'cargoId', 'cargo-b'],
  ['Área', 'area-b', 'areaId', 'area-b'],
  ['Subárea', 'Nova Subárea', 'subarea', 'Nova Subárea'],
  ['Nível', 'N2', 'nivelId', 'N2'],
  ['Gestor', 'gestor-teste', 'gestorId', 'gestor-teste'],
  ['Admissão', '2019-01-01', 'dataAdmissao', '2019-01-01'],
  ['Desligamento', '2024-01-01', 'dataDesligamento', '2024-01-01'],
  ['Salário', '2.500,38', 'salario', 2500.38],
  ['Matrícula eSocial', 'NOVA-TESTE', 'matriculaEsocial', 'NOVA-TESTE'],
  ['Vale-transporte', 'Sim', 'valeTransporte', true],
  ['Risco de saída', 'Médio', 'riscoSaida', 'Médio'],
  ['Categoria CNH', 'AB', 'cnh', 'AB'],
  ['Desde', '2022-01-01', 'dataInicioCargo', '2022-01-01'],
  ['Humor / engajamento', 'Motivado', 'humor', 'Motivado'],
  ['Estilo de aprendizagem', 'Auditivo', 'estiloAprendizagem', 'Auditivo'],
  ['Empresa', 'Forte Mais', 'empresa', 'Forte Mais'],
  ['Sexo', 'Masculino', 'sexo', 'Masculino'],
  ['Setor', 'Novo Setor', 'setor', 'Novo Setor'],
  ['Padrinho (mentor)', 'gestor-teste', 'padrinhoId', 'gestor-teste'],
] as const;
function Exemplo({ editar = true, sens = true, gestao = true }) {
  const d = useDominio(); const c = d.colabById.get(base.id)!;
  return <AbaDados c={c} sens={sens} podeEditar={editar} verGestao={gestao} cargo={d.cargoById.get(c.cargoId ?? '')} />;
}
async function montar(props = {}) { await act(async () => root.render(<MemoryRouter><ToastProvider><Exemplo {...props} /></ToastProvider></MemoryRouter>)); }
function button(titulo: string) { const b = el.querySelector<HTMLButtonElement>(`[title="Clique para editar: ${titulo}"]`); expect(b, `Abrir ${titulo}`).toBeTruthy(); return b!; }
async function abrir(titulo: string) { await act(async () => button(titulo).click()); return [...el.querySelectorAll('dt')].find(d => d.textContent?.startsWith(titulo))!.parentElement!; }
async function preencher(caixa: Element, valor: string) {
  const campo = caixa.querySelector<HTMLInputElement | HTMLSelectElement>('input,select');
  if (campo) await act(async () => {
    Object.getOwnPropertyDescriptor(campo.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(campo, valor);
    campo.dispatchEvent(new Event(campo.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
  else {
    const chip = [...caixa.querySelectorAll<HTMLButtonElement>('[aria-pressed]')].find(b => b.textContent === valor);
    expect(chip, `Chip ${valor}`).toBeTruthy(); await act(async () => chip!.click());
  }
}
async function salvar(caixa: Element) { await act(async () => caixa.querySelector<HTMLButtonElement>('[aria-label="Salvar alteração"]')!.click()); }
function valor(c: unknown, path: string): unknown { return path.split('.').reduce((r, k) => (r as Record<string, unknown>)[k], c); }
function atual() { return obter('colaboradores').find(x => x.id === base.id)!; }
function semCarimbo(c: Colaborador) { const x = { ...c } as Record<string, unknown>; delete x.atualizadoEm; return x; }
beforeEach(async () => {
  acesso.perfil = 'ADMIN_RH'; acesso.conferindoAcesso = false; localStorage.clear(); sessionStorage.clear();
  registrarMutacao(mutacao); for (const n of NOMES_COLECOES) definirColecao(n, [] as never);
  definirColecao('colaboradores', [structuredClone(base), { id: 'gestor-teste', nome: 'Gestor Fictício', statusId: 'ativo' }]);
  definirColecao('areas', [{ id: 'area-a', nome: 'Área Fictícia A', ordem: 1 }, { id: 'area-b', nome: 'Área Fictícia B', ordem: 2 }]);
  definirColecao('cargos', [{ id: 'cargo-a', nome: 'Cargo Fictício A', areaId: 'area-a', faixas: [2000, 2100, 2200, 2300, 2400] }, { id: 'cargo-b', nome: 'Cargo Fictício B', areaId: 'area-a', faixas: [3000, 3100, 3200, 3300, 3400] }]);
  definirColecao('niveis', [1, 2].map(n => ({ id: `N${n}`, codigo: `N${n}`, nome: `Nível ${n}`, senioridade: '', ordem: n })));
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Teste sem rede'); })); mutacao.mockClear();
  el = document.createElement('div'); document.body.append(el); root = createRoot(el); await montar();
});
afterEach(() => { act(() => root.unmount()); el.remove(); vi.unstubAllGlobals(); });

it.each(campos)('edita e persiste %s preservando dados não relacionados', async (label, texto, chave, esperado) => {
  const antes = structuredClone(atual()); const caixa = await abrir(label); await preencher(caixa, texto); await salvar(caixa);
  expect(caixa.querySelector('[role="alert"]')?.textContent).toBeFalsy(); expect(valor(atual(), chave)).toEqual(esperado);
  const persistido = JSON.parse(lerLocal('impresilk.rh.v1:col:colaboradores')!)[0]; expect(valor(persistido, chave)).toEqual(esperado);
  expect(mutacao).toHaveBeenCalled(); expect(atual().idPessoa).toBe('000001'); expect(atual().filhos).toEqual(antes.filhos);
  const permitidos = new Set([chave.split('.')[0], 'atualizadoEm', ...(['cargoId', 'nivelId', 'areaId', 'salario'].includes(chave) ? ['cargoId', 'refMin', 'refMax', 'enquadramento'] : [])]);
  for (const [k, v] of Object.entries(antes)) if (!permitidos.has(k)) expect(valor(atual(), k), `Preservar ${k}`).toEqual(v);
});

it.each(campos)('abre e cancela %s sem gravar nem enviar mudança', async (label, texto) => {
  const antes = semCarimbo(atual()); const caixa = await abrir(label); await preencher(caixa, texto);
  await act(async () => caixa.querySelector<HTMLButtonElement>('[aria-label="Cancelar edição"]')!.click());
  expect(semCarimbo(atual())).toEqual(antes); expect(mutacao).not.toHaveBeenCalled();
});

it('todos os editores da aba estão cobertos pelo roteiro campo por campo', () => {
  const labels = [...el.querySelectorAll('[title^="Clique para editar:"]')].map(b => b.getAttribute('title')!.replace('Clique para editar: ', '')).sort();
  expect(labels).toEqual(campos.map(c => c[0]).sort());
});

it.each([
  ['CPF', '123', /CPF/], ['Apelido (login)', 'ab', /apelido/], ['E-mail', 'email inválido', /mail/],
  ['Telefone', '123', /DDD/], ['Telefone do cônjuge', 'texto', /DDD/], ['Telefone de emergência', '123', /DDD/], ['CEP', '123', /CEP/],
  ['Nascimento', '2099-01-01', /Ano|futuro/], ['Admissão', '2022-01-01', /cargo/], ['Desligamento', '2019-01-01', /admissão/],
  ['Desde', '2019-01-01', /admissão/], ['Salário', '-10', /inválido|ambíguo/], ['Salário', '2.500.38', /ambíguo/],
] as const)('recusa %s inválido (%s) sem perder texto ou gravar', async (label, texto, erro) => {
  const antes = structuredClone(atual()); const caixa = await abrir(label); await preencher(caixa, texto); await salvar(caixa);
  expect(caixa.querySelector('[role="alert"]')?.textContent).toMatch(erro); expect(atual()).toEqual(antes); expect(mutacao).not.toHaveBeenCalled();
});

it('CPF duplicado não divide identidade em duas fichas', async () => {
  await act(async () => definirColecao('colaboradores', [base, { id: 'outra-ficticia', nome: 'Outra Fictícia', cpf: '111.444.777-35' }]));
  const caixa = await abrir('CPF'); await preencher(caixa, '11144477735'); await salvar(caixa);
  expect(caixa.querySelector('[role="alert"]')?.textContent).toContain('já é'); expect(atual().cpf).toBe(base.cpf);
});
it('troca de área avisa, limpa cargo incompatível e não inventa faixa', async () => {
  const caixa = await abrir('Área'); await preencher(caixa, 'area-b'); await salvar(caixa);
  expect(atual()).toMatchObject({ areaId: 'area-b', cargoId: null, refMin: null, refMax: null, enquadramento: null });
  expect(el.textContent).toContain('não existe na nova área');
});
it('família, complemento e vínculos gravados estão visíveis sem perder a contagem antiga de filhos', () => {
  for (const texto of ['Bloco Fictício', '(00) 90000-0001', 'Dependente Fictício', '01/01/2015', 'Função legada fictícia', 'Cargo livre fictício', 'Observação fictícia']) expect(el.textContent).toContain(texto);
  expect(atual().qtdFilhos).toBe(2);
});
it('leitura de gestor oculta dados sensíveis mesmo que ainda estejam no cache', async () => {
  await montar({ editar: false, sens: false, gestao: true });
  for (const texto of [base.cpf!, base.telefone!, base.enderecoRua!, base.enderecoComplemento!, base.conjugeNome!, base.conjugeTelefone!, base.contatoEmergencia!.nome, base.matriculaEsocial!]) expect(el.textContent).not.toContain(texto);
  expect(el.querySelector('[title^="Clique para editar:"]')).toBeNull();
});
it('colaborador não recebe avaliação de gestão nem ações de edição', async () => {
  await montar({ editar: false, sens: true, gestao: false });
  for (const label of ['Risco de saída', 'Humor / engajamento', 'Estilo de aprendizagem', 'Observação de enquadramento']) expect(el.textContent).not.toContain(label);
  expect(el.querySelector('[title^="Clique para editar:"]')).toBeNull();
});
it('rota direta de ficha alheia é bloqueada para comercial', async () => {
  acesso.perfil = 'COLABORADOR';
  await act(async () => definirColecao('colaboradores', [base]));
  await act(async () => root.render(<MemoryRouter key="rota-direta" initialEntries={['/colaboradores/pessoa-ficticia']}><ToastProvider><Routes><Route path="/colaboradores/:id" element={<ColaboradorFicha />} /></Routes></ToastProvider></MemoryRouter>));
  expect(el.textContent).toContain('Acesso restrito'); expect(el.textContent).not.toContain(base.nome);
});
it('aguarda validação de acesso antes de mostrar ficha em cache', async () => {
  acesso.conferindoAcesso = true;
  await act(async () => root.render(<MemoryRouter key="rota-direta" initialEntries={['/colaboradores/pessoa-ficticia']}><ToastProvider><Routes><Route path="/colaboradores/:id" element={<ColaboradorFicha />} /></Routes></ToastProvider></MemoryRouter>));
  expect(el.textContent).toContain('Conferindo acesso'); expect(el.textContent).not.toContain(base.nome);
});

async function montarCompleto() {
  await act(async () => root.render(<MemoryRouter key="cadastro-completo"><ToastProvider><ColaboradorForm aberto editar={atual()} onFechar={() => {}} /></ToastProvider></MemoryRouter>));
}
async function preencherCompleto(nome: string, valor: string) {
  const label = [...document.querySelectorAll('label')].find(l => l.textContent?.replace(/\*/g, '').replace(/\bfalta\b/g, '').trim() === nome)!;
  expect(label, nome).toBeTruthy(); const input = label.control as HTMLInputElement;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, valor); input.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function salvarCompleto() { await act(async () => [...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find(b => b.textContent === 'Salvar')!.click()); }
it('cadastro completo preserva complementos, filhos e campos legados ao mudar só o nome', async () => {
  await montarCompleto(); await preencherCompleto('Nome completo', 'Pessoa Fictícia Revisada'); await salvarCompleto();
  expect(atual().nome).toBe('Pessoa Fictícia Revisada');
  for (const campo of ['enderecoComplemento','conjugeTelefone','qtdFilhos','filhos','contatoEmergencia','setor','funcao','cargoLivre','pontosFortes','idPessoa']) expect(valor(atual(), campo)).toEqual(valor(base, campo));
});
it.each([['CEP','123'],['Telefone','123'],['Início no cargo atual','2019-01-01']])('cadastro completo também recusa %s inválido', async (label, texto) => {
  await montarCompleto(); await preencherCompleto(label, texto); await salvarCompleto();
  expect(atual()).toEqual(base); expect(document.querySelector('[role="alert"]')).toBeTruthy(); expect(mutacao).not.toHaveBeenCalled();
});
it('cadastro completo não salva depois de perder acesso de RH', async () => {
  await montarCompleto(); await preencherCompleto('Nome completo','Não pode gravar'); acesso.perfil = 'COLABORADOR'; await montarCompleto(); await salvarCompleto();
  expect(mutacao).not.toHaveBeenCalled(); expect(document.body.textContent).toContain('acesso de edição foi retirado');
});

it('mudança remota de área não permite salvar cargo da área antiga', async () => {
  const caixa = await abrir('Cargo'); await preencher(caixa, 'cargo-b');
  await act(async () => definirColecao('colaboradores', [{ ...atual(), areaId: 'area-b' }]));
  await salvar(caixa);
  expect(caixa.querySelector('[role="alert"]')?.textContent).toContain('não pertence à área');
  expect(atual().cargoId).toBe('cargo-a'); expect(mutacao).not.toHaveBeenCalled();
});
it('gestor abaixo da própria pessoa não cria ciclo no organograma', async () => {
  await act(async () => definirColecao('colaboradores', [base, { id: 'gestor-teste', nome: 'Gestor Fictício', statusId: 'ativo', gestorId: base.id }]));
  const caixa = await abrir('Gestor'); await preencher(caixa, 'gestor-teste'); await salvar(caixa);
  expect(caixa.querySelector('[role="alert"]')?.textContent).toContain('ciclo'); expect(mutacao).not.toHaveBeenCalled();
});
it('apelido duplicado é recusado com orientação', async () => {
  await act(async () => definirColecao('colaboradores', [base, { id: 'outra-ficticia', nome: 'Outra Fictícia', apelido: 'outroteste' }]));
  const caixa = await abrir('Apelido (login)'); await preencher(caixa, 'Outro Teste'); await salvar(caixa);
  expect(caixa.querySelector('[role="alert"]')?.textContent).toContain('já é'); expect(mutacao).not.toHaveBeenCalled();
});

it('exclui apenas a ficha e suas dependências pelas versões conhecidas, sem reenviar coleções', async () => {
  vi.mocked(enviarColecao).mockClear(); vi.mocked(apagarRegistrosNuvem).mockClear();
  const outra = structuredClone(obter('colaboradores')[1]);
  await act(async () => {
    definirColecao('colaboradores', [{ ...base, _rhRev: 7 } as Colaborador, outra]);
    definirColecao('documentos', [
      { id:'doc-teste', colaboradorId:base.id, nome:'Documento fictício', _rhRev:4 },
      { id:'doc-outra', colaboradorId:outra.id, nome:'Preservado', _rhRev:9 },
    ] as never);
  });
  await montarCompleto();
  await act(async () => [...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()==='Apagar cadastro')!.click());
  const prova = document.querySelector<HTMLInputElement>(`input[placeholder="${base.id}"]`);
  if (prova) await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(prova,base.id);
    prova.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await act(async () => [...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()==='Apagar tudo')!.click());
  expect(obter('colaboradores')).toEqual([outra]);
  expect(obter('documentos')).toEqual([{id:'doc-outra',colaboradorId:outra.id,nome:'Preservado',_rhRev:9}]);
  expect(mutacao).toHaveBeenCalledWith('colaboradores','delete',base.id,7);
  expect(mutacao).toHaveBeenCalledWith('documentos','delete','doc-teste',4);
  expect(enviarColecao).not.toHaveBeenCalled();
  expect(apagarRegistrosNuvem).not.toHaveBeenCalled();
});
