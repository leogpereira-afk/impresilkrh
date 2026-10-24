// Auditoria local, somente dados ficticios. Nenhuma comunicacao produtiva.
import { act, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
const rede=vi.hoisted(()=>({pausar:false,falhar:false,rejeitar:false,resolver:null as null|(()=>void)}));
vi.mock('@/lib/session',()=>({useSessao:()=>({perfil:'ADMIN_RH',colaboradorId:'pessoa-ficticia',id:'admin-ficticio'}),obterSessao:()=>({perfil:'ADMIN_RH',colaboradorId:'pessoa-ficticia',id:'admin-ficticio'})}));
vi.mock('@/lib/sync',()=>({enviarArquivoNuvem:vi.fn(async()=>{if(rede.pausar)await new Promise<void>(r=>{rede.resolver=r;});if(rede.rejeitar)throw new Error('Falha ficticia de upload');return !rede.falhar;}),buscarArquivoNuvem:vi.fn(async()=>null),enviarColecao:vi.fn(),enviarConfigNuvem:vi.fn(),apagarRegistrosNuvem:vi.fn()}));
vi.mock('@/lib/blobstore',()=>({putBlob:vi.fn(async()=>true),getBlob:vi.fn(async()=>null),delBlob:vi.fn(async()=>{})}));
vi.mock('@/components/charts/charts',()=>({BarrasVerticais:()=>null,BarrasColoridas:()=>null,BarrasHorizontais:()=>null,Rosca:()=>null,Linha:()=>null,Area:()=>null}));
import {NOMES_COLECOES} from '@/data';
import {definirColecao,obter,registrarMutacao} from '@/lib/store';
import Vagas from '@/pages/Vagas';
import Cargos from '@/pages/Cargos';
import Ponto from '@/pages/Ponto';
import {ViagensPainel} from '@/pages/Viagens';
import SST from '@/pages/SST';
import PainelControle from '@/pages/PainelControle';
import {ToastProvider} from '@/components/ui/toast';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT=true;
let el:HTMLDivElement;let root:ReturnType<typeof createRoot>;
async function mount(C:ComponentType,entry='/'){await act(async()=>root.render(<MemoryRouter initialEntries={[entry]}><ToastProvider><C/></ToastProvider></MemoryRouter>));}
async function click(text:string){const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim()===text||x.getAttribute('aria-label')===text||x.getAttribute('title')===text);expect(b,`button ${text}`).toBeTruthy();await act(async()=>b!.click());}
function field(label:string){const l=[...document.querySelectorAll('label')].find(x=>x.textContent?.replace(/\*/g,'').replace(/\bfalta\b/g,'').trim()===label);expect(l,`field ${label}`).toBeTruthy();return l!.control as HTMLInputElement;}
async function fill(e:HTMLInputElement,value:string){await act(async()=>{const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value')!.set!.call(e,value);e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));});}
beforeEach(()=>{
 rede.pausar=false;rede.falhar=false;rede.rejeitar=false;rede.resolver=null;localStorage.clear();sessionStorage.clear();registrarMutacao(()=>{});for(const n of NOMES_COLECOES)definirColecao(n,[] as never);
 definirColecao('colaboradores',[{id:'pessoa-ficticia',idPessoa:'000001',nome:'Pessoa de Teste Ficticia',statusId:'ativo',areaId:'area-ficticia'}] as never);
 definirColecao('areas',[{id:'area-ficticia',nome:'Area Ficticia'}] as never);
 vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Rede bloqueada no teste');}));
 el=document.createElement('div');document.body.appendChild(el);root=createRoot(el);
});
afterEach(()=>{act(()=>root.unmount());el.remove();vi.unstubAllGlobals();vi.useRealTimers();});
it('vaga recusa quantidade negativa apesar de min=1',async()=>{
 await mount(Vagas);await click('Nova vaga');await fill(field('Título da vaga'),'Vaga ficticia');await fill(field('Vagas'),'-2');
 expect(field('Vagas').validity.rangeUnderflow).toBe(true);await click('Salvar');
 expect(obter('vagas')).toHaveLength(0);expect(document.querySelector('[role=alert]')?.textContent).toMatch(/quantidade|inteir/i);
});
it('vaga recusa quantidade fracionada',async()=>{
 await mount(Vagas);await click('Nova vaga');await fill(field('Título da vaga'),'Vaga ficticia');await fill(field('Vagas'),'1.5');await click('Salvar');
 expect(obter('vagas')).toHaveLength(0);expect(document.querySelector('[role=alert]')?.textContent).toMatch(/quantidade|inteir/i);
});
it('cargo recusa salario negativo sem converter em positivo',async()=>{
 await mount(Cargos);await click('Novo cargo');await fill(field('Nome do cargo'),'Cargo ficticio');await fill(field('Salário praticado hoje'),'-1234,56');await click('Salvar');
 expect(obter('cargos')).toHaveLength(0);expect(document.querySelector('[role=alert]')?.textContent).toMatch(/salário/i);
});
it('ausencia recusa horas negativas',async()=>{
 await mount(Ponto,'/ponto?aba=absenteismo');await click('Lançar falta / ausência');await fill(field('Tipo'),'Atraso');await fill(field('Horas'),'-2');
 expect(field('Horas').validity.rangeUnderflow).toBe(true);await click('Lançar');
 expect(obter('ausencias')).toHaveLength(0);expect(document.querySelector('[role=alert]')?.textContent).toMatch(/horas/i);
});
it('ausencia recusa data futura apesar de max',async()=>{
 await mount(Ponto,'/ponto?aba=absenteismo');await click('Lançar falta / ausência');await fill(field('Data'),'2099-01-01');
 expect(field('Data').validity.rangeOverflow).toBe(true);await click('Lançar');
 expect(obter('ausencias')).toHaveLength(0);expect(document.querySelector('[role=alert]')?.textContent).toMatch(/futur/i);
});
it('viagem recusa termino anterior ao inicio',async()=>{
 await mount(ViagensPainel);await click('Nova viagem');await fill(field('Colaborador'),'pessoa-ficticia');await fill(field('Destino'),'Destino Ficticio');await fill(field('Data de início'),'2026-10-20');await fill(field('Data de término'),'2026-10-01');await fill(field('Dias'),'3');await fill(field('Valor da diária (R$)'),'10');await click('Salvar');
 expect(obter('viagens')).toHaveLength(0);expect(document.querySelector('[role=alert]')?.textContent).toMatch(/anterior|antes/i);
});
it('CONTROLE vaga vazia nao grava',async()=>{
 await mount(Vagas);await click('Nova vaga');await click('Salvar');expect(obter('vagas')).toHaveLength(0);expect(document.querySelector('[role=dialog]')).toBeTruthy();
});
it('CONTROLE cargo sem nome nao grava e informa erro',async()=>{
 await mount(Cargos);await click('Novo cargo');await click('Salvar');expect(obter('cargos')).toHaveLength(0);expect(document.querySelector('[role=alert]')?.textContent).toContain('nome');
});
it('salvar candidato duas vezes durante upload preserva um cadastro',async()=>{
 rede.pausar=true;await mount(Vagas,'/vagas?aba=banco');
 const btn=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Guardar currículo'));
 expect(btn).toBeTruthy();await act(async()=>btn!.click());await fill(field('Nome'),'Candidato Ficticio');
 const input=document.querySelector('input[type=file]')!;
 await act(async()=>{Object.defineProperty(input,'files',{value:[new File(['arquivo ficticio'],'curriculo-ficticio.pdf',{type:'application/pdf'})]});input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,20));});
 await vi.waitFor(()=>expect(document.body.textContent).toContain('curriculo-ficticio.pdf'));
 await click('Salvar');expect(obter('candidatos')).toHaveLength(1);expect(document.querySelector('[role=dialog]')).toBeTruthy();
 const id=obter('candidatos')[0].id;const salvar=document.querySelector<HTMLButtonElement>('[role=dialog] button[aria-busy=true]') ?? [...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find(b=>b.textContent==='Salvar')!;await act(async()=>{salvar.click();salvar.click();});expect(obter('candidatos')).toHaveLength(1);expect(salvar.disabled).toBe(true);await act(async()=>rede.resolver?.());expect(obter('candidatos')[0].id).toBe(id);expect(document.querySelector('[role=dialog]')).toBeNull();
});
const FORMULARIOS=[
 {nome:'Vagas',C:Vagas,entry:'/',abrir:'Nova vaga',salvar:'Salvar',campo:'Título da vaga'},
 {nome:'Cargos',C:Cargos,entry:'/',abrir:'Novo cargo',salvar:'Salvar',campo:'Nome do cargo'},
 {nome:'SST',C:SST,entry:'/sst?aba=certificacoes',abrir:'Registrar NR',salvar:'Salvar',campo:'Instituição'},
 {nome:'Viagens',C:ViagensPainel,entry:'/',abrir:'Nova viagem',salvar:'Salvar',campo:'Destino'},
];
const retrato=()=>JSON.stringify(NOMES_COLECOES.map(n=>[n,obter(n)]));
it.each(FORMULARIOS)('CONTROLE $nome formulario vazio nao cria registros',async f=>{
 await mount(f.C,f.entry);await click(f.abrir);const antes=retrato();await click(f.salvar);expect(retrato()).toBe(antes);
});
it.each(FORMULARIOS)('CONTROLE $nome preencher e cancelar preserva todas colecoes',async f=>{
 await mount(f.C,f.entry);const antes=retrato();await click(f.abrir);await fill(field(f.campo),'Texto Ficticio');await click('Cancelar');expect(retrato()).toBe(antes);
});
it('SST recusa carga horaria negativa no certificado',async()=>{
 await mount(SST,'/sst?aba=certificacoes');await click('Registrar NR');await fill(field('Colaborador'),'pessoa-ficticia');await fill(field('Data do treinamento'),'2026-01-01');await fill(field('Carga horária (h)'),'-8');await click('Salvar');expect(obter('certificacoesNr')).toHaveLength(0);expect(document.querySelector('[role=alert]')?.textContent).toMatch(/carga horária/i);
});
it('CONTROLE SST recusa treinamento futuro',async()=>{
 await mount(SST,'/sst?aba=certificacoes');await click('Registrar NR');await fill(field('Colaborador'),'pessoa-ficticia');await fill(field('Data do treinamento'),'2099-01-01');await click('Salvar');expect(obter('certificacoesNr')).toHaveLength(0);expect(document.querySelector('[role=alert]')?.textContent).toContain('futuro');
});
it('Configuracoes recusa faixa salarial negativa e invertida',async()=>{
 await mount(PainelControle,'/painel-controle?aba=cargos');await click('Novo cargo');await fill(field('Nome do cargo'),'Cargo de teste');const ns=document.querySelectorAll<HTMLInputElement>('[role=dialog] input[type=number]');expect(ns).toHaveLength(5);await fill(ns[0],'3000');await fill(ns[1],'-1');await fill(ns[4],'1000');await click('Salvar');expect(obter('cargos')).toHaveLength(0);expect(document.querySelector('[role=alert]')?.textContent).toMatch(/faixas|faixa/i);
});
it('CONTROLE vaga valida salva quantidade inteira ',async()=>{
 await mount(Vagas);await click('Nova vaga');await fill(field('Título da vaga'),'Vaga Valida Ficticia');await fill(field('Vagas'),'2');await click('Salvar');expect(obter('vagas')[0]).toMatchObject({titulo:'Vaga Valida Ficticia',quantidade:2});
});
it('CONTROLE cargo valido salva valor brasileiro',async()=>{
 await mount(Cargos);await click('Novo cargo');await fill(field('Nome do cargo'),'Cargo Ficticio');await fill(field('Salário praticado hoje'),'1.234,56');await click('Salvar');expect(obter('cargos')[0].salarioPraticado).toBe(1234.56);
});
it('CONTROLE certificado NR valido grava carga e data',async()=>{
 await mount(SST,'/sst?aba=certificacoes');await click('Registrar NR');await fill(field('Colaborador'),'pessoa-ficticia');await fill(field('Data do treinamento'),'2026-01-01');await fill(field('Carga horária (h)'),'8');await click('Salvar');expect(obter('certificacoesNr')[0]).toMatchObject({cargaHoraria:8,dataTreinamento:'2026-01-01'});
});
it('CONTROLE viagem valida calcula total',async()=>{
 await mount(ViagensPainel);await click('Nova viagem');await fill(field('Colaborador'),'pessoa-ficticia');await fill(field('Destino'),'Destino Ficticio');await fill(field('Data de início'),'2026-10-01');await fill(field('Data de término'),'2026-10-03');await fill(field('Dias'),'3');await fill(field('Valor da diária (R$)'),'10');await click('Salvar');expect(obter('viagens')[0].valorTotal).toBe(30);
});
it('vaga criada depois de21h preserva dia local de abertura',async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-24T22:00:00-03:00'));await mount(Vagas);await click('Nova vaga');await fill(field('Título da vaga'),'Vaga Noturna Ficticia');await click('Salvar');expect(obter('vagas')[0].dataAbertura).toBe('2026-10-24');
});

async function prepararCandidatoComArquivo() {
 await mount(Vagas,'/vagas?aba=banco');
 const abrir=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Guardar currículo'))!;
 await act(async()=>abrir.click());await fill(field('Nome'),'Candidato Ficticio');
 const input=document.querySelector('input[type=file]')!;
 await act(async()=>{Object.defineProperty(input,'files',{value:[new File(['arquivo ficticio'],'curriculo-ficticio.pdf',{type:'application/pdf'})]});input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,20));});
 await vi.waitFor(()=>expect(document.body.textContent).toContain('curriculo-ficticio.pdf'));
}
it.each(['retorno falso','excecao'])('retentativa apos %s do upload usa o mesmo candidato',async(modo)=>{
 rede.falhar=modo==='retorno falso';rede.rejeitar=modo==='excecao';await prepararCandidatoComArquivo();await click('Salvar');
 expect(obter('candidatos')).toHaveLength(1);const id=obter('candidatos')[0].id;
 expect(document.querySelector('[role=dialog]')).toBeTruthy();expect(document.querySelector('[role=alert]')?.textContent).toMatch(/currículo|envio/i);
 rede.falhar=false;rede.rejeitar=false;await click('Salvar');expect(obter('candidatos')).toHaveLength(1);expect(obter('candidatos')[0]).toMatchObject({id,curriculoArquivo:true,curriculoNome:'curriculo-ficticio.pdf'});expect(document.querySelector('[role=dialog]')).toBeNull();
});
it('cancelar candidato antes de salvar preserva o banco',async()=>{await prepararCandidatoComArquivo();await click('Cancelar');expect(obter('candidatos')).toHaveLength(0);});
it('Configuracoes recusa faixa invertida mesmo sem negativos',async()=>{
 await mount(PainelControle,'/painel-controle?aba=cargos');await click('Novo cargo');await fill(field('Nome do cargo'),'Cargo Ficticio');const ns=document.querySelectorAll<HTMLInputElement>('[role=dialog] input[type=number]');await fill(ns[0],'3000');await click('Salvar');expect(obter('cargos')).toHaveLength(0);expect(document.querySelector('[role=alert]')?.textContent).toMatch(/ordem|crescente|progress/i);
});
it.each([[0,0,0,0,0],[1000,0,1400,0,2000]])('Configuracoes preserva nivel sem faixa definida: %j',async(...valores)=>{
 await mount(PainelControle,'/painel-controle?aba=cargos');await click('Novo cargo');await fill(field('Nome do cargo'),'Cargo Ficticio');const ns=document.querySelectorAll<HTMLInputElement>('[role=dialog] input[type=number]');for(const [i,v] of valores.entries())await fill(ns[i],String(v));await click('Salvar');expect(obter('cargos')[0].faixas).toEqual(valores);
});
it('viagem aceita diarias diferentes dos dias corridos',async()=>{
 await mount(ViagensPainel);await click('Nova viagem');await fill(field('Colaborador'),'pessoa-ficticia');await fill(field('Destino'),'Destino Ficticio');await fill(field('Data de início'),'2026-10-01');await fill(field('Data de término'),'2026-10-03');await fill(field('Dias'),'1.5');await fill(field('Valor da diária (R$)'),'10');await click('Salvar');expect(obter('viagens')[0]).toMatchObject({dias:1.5,valorTotal:15});
});
it('ausencia valida grava horas sem alterar a pessoa',async()=>{
 await mount(Ponto,'/ponto?aba=absenteismo');await click('Lançar falta / ausência');await fill(field('Tipo'),'Atraso');await fill(field('Data'),'2026-01-01');await fill(field('Horas'),'2.5');await click('Lançar');expect(obter('ausencias')[0]).toMatchObject({colaboradorId:'pessoa-ficticia',data:'2026-01-01',horas:2.5});
});

it('cliques no mesmo evento antes de renderizar busy criam so um candidato',async()=>{
 rede.pausar=true;await prepararCandidatoComArquivo();const salvar=[...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find(b=>b.textContent==='Salvar')!;
 await act(async()=>{salvar.click();salvar.click();});expect(obter('candidatos')).toHaveLength(1);await act(async()=>rede.resolver?.());expect(document.querySelector('[role=dialog]')).toBeNull();
});
it('candidato em envio permanece no modal ao cancelar ou apertar Escape',async()=>{
 rede.pausar=true;await prepararCandidatoComArquivo();await click('Salvar');await click('Cancelar');await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(document.querySelector('[role=dialog]')).toBeTruthy();await act(async()=>rede.resolver?.());expect(obter('candidatos')).toHaveLength(1);expect(document.querySelector('[role=dialog]')).toBeNull();
});
it.each(['0',''])('vaga recusa quantidade vazia ou zero: %s',async(valor)=>{
 await mount(Vagas);await click('Nova vaga');await fill(field('Título da vaga'),'Vaga Ficticia');await fill(field('Vagas'),valor);await click('Salvar');expect(obter('vagas')).toHaveLength(0);
});
it.each(['Infinity','R$ -1234,56','texto','9'.repeat(320)])('cargo recusa salario invalido: %s',async(valor)=>{
 await mount(Cargos);await click('Novo cargo');await fill(field('Nome do cargo'),'Cargo Ficticio');await fill(field('Salário praticado hoje'),valor);await click('Salvar');expect(obter('cargos')).toHaveLength(0);expect(document.querySelector('[role=alert]')?.textContent).toMatch(/salário/i);
});
it('faixa nao finita existente deve ser corrigida antes de salvar outra mudanca',async()=>{
 definirColecao('cargos',[{id:'cargo-ficticio',nome:'Cargo Ficticio',areaId:'area-ficticia',faixas:[1000,1200,Infinity,1600,2000]}] as never);
 await mount(PainelControle,'/painel-controle?aba=cargos');await click('Editar Cargo Ficticio');await fill(field('Nome do cargo'),'Alteracao Ficticia');await click('Salvar');expect(obter('cargos')[0].nome).toBe('Cargo Ficticio');expect(document.querySelector('[role=alert]')?.textContent).toMatch(/faixas/i);
});
it('NR recusa carga nao finita e preserva o registro em edicao',async()=>{
 definirColecao('certificacoesNr',[{id:'nr-ficticia',colaboradorId:'pessoa-ficticia',nr:'NR-10',dataTreinamento:'2026-01-01',cargaHoraria:Infinity}] as never);
 await mount(SST,'/sst?aba=certificacoes');await click('Editar');await fill(field('Instituição'),'Instituicao Ficticia');await click('Salvar');expect(obter('certificacoesNr')[0].instituicao).toBeUndefined();expect(document.querySelector('[role=alert]')?.textContent).toMatch(/carga horária/i);
});
it('NR permite carga horaria nao informada',async()=>{
 await mount(SST,'/sst?aba=certificacoes');await click('Registrar NR');await fill(field('Colaborador'),'pessoa-ficticia');await fill(field('Data do treinamento'),'2026-01-01');await click('Salvar');expect(obter('certificacoesNr')).toHaveLength(1);expect(obter('certificacoesNr')[0].cargaHoraria).toBeUndefined();
});
it('cancelar ausencia preserva todas as colecoes',async()=>{
 await mount(Ponto,'/ponto?aba=absenteismo');const antes=retrato();await click('Lançar falta / ausência');await fill(field('Tipo'),'Atraso');await fill(field('Horas'),'2');await click('Cancelar');expect(retrato()).toBe(antes);
});

it('falha ao gravar metadados depois de criar candidato preserva ID na retentativa',async()=>{
 await prepararCandidatoComArquivo();
 registrarMutacao((colecao)=>{if(colecao==='candidatos' && obter('candidatos').some(c=>c.curriculoArquivo))throw new Error('Fila ficticia sem espaco');});
 await click('Salvar');expect(obter('candidatos')).toHaveLength(1);const id=obter('candidatos')[0].id;expect(obter('candidatos')[0].curriculoArquivo).toBeUndefined();expect(document.querySelector('[role=dialog]')).toBeTruthy();
 registrarMutacao(()=>{});await click('Salvar');expect(obter('candidatos')).toHaveLength(1);expect(obter('candidatos')[0]).toMatchObject({id,curriculoArquivo:true});expect(document.querySelector('[role=dialog]')).toBeNull();
});

it('criacao parcialmente persistida com falha da fila e do rollback retenta o mesmo ID',async()=>{
 await prepararCandidatoComArquivo();
 let falhaStorage: ReturnType<typeof vi.spyOn> | undefined;
 registrarMutacao((colecao)=>{if(colecao==='candidatos'){
  falhaStorage=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('Storage ficticio bloqueado','QuotaExceededError');});
  throw new Error('Fila ficticia sem espaco');
 }});
 await click('Salvar');expect(obter('candidatos')).toHaveLength(1);const id=obter('candidatos')[0].id;expect(document.querySelector('[role=dialog]')).toBeTruthy();
 falhaStorage!.mockRestore();registrarMutacao(()=>{});await click('Salvar');expect(obter('candidatos')).toHaveLength(1);expect(obter('candidatos')[0]).toMatchObject({id,curriculoArquivo:true});expect(document.querySelector('[role=dialog]')).toBeNull();
});
