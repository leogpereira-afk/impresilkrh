import { describe, expect, it } from 'vitest';
import { apurarPessoa, novaPessoa, novoCiclo, validarAprovacao, validarEntrega, validarPlantao, minutosTurno, validarRegra } from './performance';
import type { EntregaPerformance, Plantao } from '@/data/performance';
import { projetarOrdem } from '../../supabase/functions/_shared/performanceOS';
const entrega=(patch:Partial<EntregaPerformance>={}):EntregaPerformance=>({id:'v1',colaboradorId:'ana',os:{id:'os1',numero:'123',cliente:'Teste',servico:'Fachada',finalizadaEm:'2026-09-12',prazo:'2026-09-12',equipe:['Ana'],retrabalho:false,baixaAutomatica:false,atualizadoEm:''},participacao:100,complexidade:5,evidencia:'Checklist conferido, fachada complexa',aceite:true,qualidade:'sem_retrabalho',prazo:'no_prazo',justificativa:'',...patch});
const montar=()=>{const c=novoCiclo('2026-09');c.regra={...c.regra,tetoIndividual:500,orcamento:1000,referencia:'Meta combinada antes do ciclo; três meses de referência.'};c.pessoas=[{...novaPessoa('ana'),habitual:3,meta:5,colaboracao:[100,100,100],evidenciaColaboracao:'Registros e comunicação conferidos'}];c.entregas=[entrega()];return c;};
const plantao=(patch:Partial<Plantao>={}):Plantao=>({id:'p1',titulo:'Instalação',data:'2026-09-12',inicio:'08:00',fim:'12:00',intervaloMin:0,tipo:'Sábado',local:'Obra',osNumero:'123',observacao:'',participantes:[{colaboradorId:'ana',situacao:'Escalado',realizadoMin:null,extrasMin:null}],cancelado:false,criadoPor:'rh',atualizadoEm:'',...patch});
describe('performance: pesos, evidências e decisão humana',()=>{
 it('calcula proposta transparente sem criar pagamentos',()=>{const c=montar();expect(apurarPessoa(c,c.pessoas[0])).toMatchObject({pontos:5,nota:100,sugestao:500,elegivel:true});expect(c.pessoas[0].aprovacao).toBeUndefined();});
 it('não transforma falta de evidência em zero ou aprovação',()=>{const c=montar();c.entregas[0].evidencia='';expect(apurarPessoa(c,c.pessoas[0])).toMatchObject({nota:null,elegivel:false,sugestao:0});});
 it('nota respeita participação e não duplica produção da equipe',()=>{const c=montar();c.entregas[0].participacao=50;expect(apurarPessoa(c,c.pessoas[0]).pontos).toBe(2.5);expect(apurarPessoa(c,c.pessoas[0]).elegivel).toBe(false);});
 it('atribui retrabalho de execução na qualidade',()=>{const c=montar();c.entregas[0].qualidade='execucao';c.entregas[0].justificativa='Fixação fora do checklist';expect(apurarPessoa(c,c.pessoas[0]).notas.qualidade).toBe(0);expect(apurarPessoa(c,c.pessoas[0]).sugestao).toBe(0);});
 it('não penaliza material ou alteração do cliente',()=>{const c=montar();c.entregas[0].qualidade='externo';c.entregas[0].justificativa='Cliente alterou projeto';expect(apurarPessoa(c,c.pessoas[0]).notas.qualidade).toBe(100);});
 it('prazos externos não viram cumprimento fictício',()=>{const c=montar();c.entregas[0].prazo='externo';c.entregas[0].justificativa='Chuva';expect(apurarPessoa(c,c.pessoas[0]).notas.prazo).toBeNull();expect(apurarPessoa(c,c.pessoas[0]).nota).toBeNull();});
 it('não sugere prêmio sem superação habitual',()=>{const c=montar();c.pessoas[0].habitual=5;c.pessoas[0].meta=6;expect(apurarPessoa(c,c.pessoas[0]).elegivel).toBe(false);});
 it('recusa meta que não supera a referência',()=>{const c=montar();c.pessoas[0].meta=3;expect(apurarPessoa(c,c.pessoas[0]).nota).toBeNull();});
 it('a aprovação precisa de orçamento, teto e justificativa',()=>{const c=montar();expect(validarAprovacao(c,c.pessoas[0],500,'Entrega conferida')).toEqual([]);expect(validarAprovacao(c,c.pessoas[0],501,'ok').join()).toContain('teto');c.regra.orcamento=400;expect(validarAprovacao(c,c.pessoas[0],500,'').length).toBeGreaterThan(1);});
 it('desconta aprovações de outras pessoas do orçamento',()=>{const c=montar();c.pessoas.push({...novaPessoa('bia'),aprovacao:{valor:600,nota:100,por:'rh',em:'',justificativa:'ok',regra:c.regra}});expect(validarAprovacao(c,c.pessoas[0],500,'ok').join()).toContain('orçamento');});
 it.each([NaN,Infinity,-1])('recusa número inválido %s',n=>{expect(validarRegra({...montar().regra,tetoIndividual:n})).not.toEqual([]);expect(validarAprovacao(montar(),montar().pessoas[0],n,'ok')).not.toEqual([]);});
 it('os pesos precisam fechar em 100',()=>{const c=montar();c.regra.pesos.entrega=90;expect(apurarPessoa(c,c.pessoas[0]).nota).toBeNull();});
 it('não altera um ciclo anterior ao preparar novo mês',()=>{const c=montar();const proximo=novoCiclo('2026-10');proximo.regra.pesos.entrega=20;expect(c.regra.pesos.entrega).toBe(35);expect(proximo.entregas).toEqual([]);});
});
describe('participação variável nas O.S.',()=>{
 it('recusa pessoa repetida na mesma OS',()=>{const c=montar();expect(validarEntrega(entrega({id:'v2'}),c).join()).toContain('já está');});
 it('permite equipe diferente por entrega e ajudante com participação parcial',()=>{const c=montar();c.pessoas.push(novaPessoa('bia'));c.entregas[0].participacao=70;expect(validarEntrega(entrega({id:'v2',colaboradorId:'bia',participacao:30}),c)).toEqual([]);});
 it('recusa participação da equipe maior que 100%',()=>{const c=montar();c.pessoas.push(novaPessoa('bia'));expect(validarEntrega(entrega({id:'v2',colaboradorId:'bia',participacao:30}),c).join()).toContain('ultrapassa');});
 it('exige complexidade igual para todos da mesma OS',()=>{const c=montar();c.pessoas.push(novaPessoa('bia'));c.entregas[0].participacao=50;expect(validarEntrega(entrega({id:'v2',colaboradorId:'bia',participacao:50,complexidade:3}),c).join()).toContain('complexidade');});
 it('recusa OS de outro mês',()=>{const c=montar();const e=entrega();e.os.finalizadaEm='2026-08-12';expect(validarEntrega(e,c).join()).toContain('mês');});
});
describe('plantões separados do calendário',()=>{
 it('desconta intervalo e recusa duração negativa',()=>{expect(minutosTurno('08:00','17:00',60)).toBe(480);expect(minutosTurno('20:00','08:00',0)).toBeNull();expect(minutosTurno('08:00','12:00',240)).toBeNull();});
 it('recusa sobreposição para a mesma pessoa',()=>{expect(validarPlantao(plantao(),[plantao({id:'p2',inicio:'10:00',fim:'15:00'})]).join()).toContain('coincidente');});
 it('permite mesmo horário para outra equipe',()=>{expect(validarPlantao(plantao(),[plantao({id:'p2',participantes:[{colaboradorId:'bia',situacao:'Escalado',realizadoMin:null,extrasMin:null}]})])).toEqual([]);});
 it('cancelado não bloqueia agenda',()=>{expect(validarPlantao(plantao(),[plantao({id:'p2',cancelado:true})])).toEqual([]);});
 it('não marca realizado sem horas conferidas',()=>{const p=plantao();p.participantes[0].situacao='Realizado';expect(validarPlantao(p,[]).join()).toContain('Informe as horas');});
 it('extras não excedem realização',()=>{const p=plantao();p.participantes[0]={...p.participantes[0],situacao:'Realizado',realizadoMin:120,extrasMin:180};expect(validarPlantao(p,[]).join()).toContain('ultrapassar');});
 it('recusa data inexistente',()=>expect(validarPlantao(plantao({data:'2026-02-30'}),[])).not.toEqual([]));
});
describe('fonte PCP mínima e competência local',()=>{
 it('não vaza dados pessoais ou trata baixa automática como aceite',()=>{const os=projetarOrdem({id:'1',numero:10,finalizadaEm:'2026-09-01T01:00:00Z',equipe:['Ana'],cnpjCpf:'privado',checkinGPS:{lat:123},baixaAutoERP:{em:'hoje'},instalacao:{data:'2026-08-31'}},'agora');expect(os.finalizadaEm).toBe('2026-08-31');expect(os.baixaAutomatica).toBe(true);expect(os).not.toHaveProperty('cnpjCpf');expect(os).not.toHaveProperty('checkinGPS');expect(os).not.toHaveProperty('aceite');});
 it('OS não finalizada não é entrega',()=>expect(projetarOrdem({id:'1',finalizadaEm:''},'').finalizadaEm).toBe(''));
});
