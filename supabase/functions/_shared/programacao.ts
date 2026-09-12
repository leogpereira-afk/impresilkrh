/** Modelo compartilhado entre navegador e servidor. Nenhum campo financeiro é usado. */
export type PessoaEscalada = { colaboradorId:string; nome:string; nomePCP:string };
export type RegrasSaida = { osValidada:boolean; prazoAcordado:boolean; dossieCompleto:boolean; exportacaoTotal:boolean; diretorLiberou:boolean; evidencia:string };
export const NOMES_REGRAS:Record<Exclude<keyof RegrasSaida,'evidencia'>,string>={osValidada:'O.S. validada',prazoAcordado:'Prazo acordado',dossieCompleto:'Dossiê completo',exportacaoTotal:'Exportação total',diretorLiberou:'Liberação do diretor conferida'};
export const regrasVazias=():RegrasSaida=>({osValidada:false,prazoAcordado:false,dossieCompleto:false,exportacaoTotal:false,diretorLiberou:false,evidencia:''});
export interface DadosProgramacao {
  participantes:PessoaEscalada[]; fim:string; motoristaId:string; lugares:number|null; grade:boolean;
  gerenteId:string; gerenteNome:string; orientacoes:string; regras:RegrasSaida;
  confirmado?:{dia:string;em:string;por:string;canal:'Telefone'|'WhatsApp';contato:string};
  atualizadoEm:string; atualizadoPor:string;
}
export interface OrdemProgramacao {
  id:string;numero:string;cliente:string;servico:string;endereco:string;data:string;hora:string;duracaoDias:number;
  equipe:string[];veiculo:string;liberadoPCP:boolean;finalizadaEm:string;rev:number;versao:string;dados:DadosProgramacao;
}
export interface EdicaoProgramacao {id:string;versao:string;data:string;hora:string;veiculo:string;dados:DadosProgramacao;confirmar?:{canal:'Telefone'|'WhatsApp';contato:string};desconfirmar?:boolean}
const texto=(v:unknown)=>typeof v==='string'||typeof v==='number'?String(v):'';
const objeto=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export const dadosVazios=():DadosProgramacao=>({participantes:[],fim:'',motoristaId:'',lugares:null,grade:false,gerenteId:'',gerenteNome:'',orientacoes:'',regras:regrasVazias(),atualizadoEm:'',atualizadoPor:''});
export function diaSP(d=new Date()):string {const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);return `${p.find(x=>x.type==='year')?.value}-${p.find(x=>x.type==='month')?.value}-${p.find(x=>x.type==='day')?.value}`;}
export const dataValida=(s:string)=>/^20\d{2}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(`${s}T12:00:00Z`))&&new Date(`${s}T12:00:00Z`).toISOString().slice(0,10)===s;
export const horaValida=(s:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export function diasDaOrdem(o:Pick<OrdemProgramacao,'data'|'duracaoDias'>):string[]{if(!dataValida(o.data))return [];return Array.from({length:Math.max(1,Math.min(366,Math.floor(o.duracaoDias)||1))},(_,i)=>{const d=new Date(`${o.data}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10);});}
export function projetarProgramacao(r:Record<string,unknown>,versao:string):OrdemProgramacao {
  const inst=objeto(r.instalacao), meta=objeto(r.programacaoRH), dados=dadosVazios(), regras=objeto(meta.regras);
  dados.participantes=Array.isArray(meta.participantes)?meta.participantes.map(objeto).filter(p=>texto(p.colaboradorId)).map(p=>({colaboradorId:texto(p.colaboradorId),nome:texto(p.nome),nomePCP:texto(p.nomePCP)})):[];
  for(const k of ['fim','motoristaId','gerenteId','gerenteNome','orientacoes','atualizadoEm','atualizadoPor'] as const)dados[k]=texto(meta[k]);
  dados.lugares=typeof meta.lugares==='number'?meta.lugares:null;dados.grade=meta.grade===true;
  for(const k of Object.keys(NOMES_REGRAS) as (keyof typeof NOMES_REGRAS)[])dados.regras[k]=regras[k]===true;
  dados.regras.evidencia=texto(regras.evidencia);
  const equipe=Array.isArray(r.equipe)?r.equipe.map(texto):[];
  dados.participantes=dados.participantes.filter(p=>equipe.includes(p.nomePCP));
  if(!dados.participantes.some(p=>p.colaboradorId===dados.motoristaId))dados.motoristaId='';
  let referencia:unknown[]=[];try{const v=JSON.parse(texto(meta.referenciaAgenda));if(Array.isArray(v))referencia=v;}catch{/* legado sem retrato */}
  if(referencia[3]!==texto(r.veiculo)){dados.lugares=null;dados.grade=false;}
  if(referencia[1]!==texto(inst.hora))dados.fim='';
  const conf=objeto(meta.confirmado);
  const assinatura=JSON.stringify([texto(inst.data),texto(inst.hora),Array.isArray(r.equipe)?r.equipe.map(texto):[],texto(r.veiculo)]);
  if(meta.referenciaAgenda===assinatura&&Number.isFinite(Date.parse(texto(conf.em)))&&dataValida(texto(conf.dia))&&['Telefone','WhatsApp'].includes(texto(conf.canal)))dados.confirmado={dia:texto(conf.dia),em:texto(conf.em),por:texto(conf.por),canal:conf.canal as 'Telefone'|'WhatsApp',contato:texto(conf.contato)};
  return {id:texto(r.id),numero:texto(r.numero),cliente:texto(r.cliente),servico:texto(r.servico),endereco:texto(r.endereco),data:texto(inst.data),hora:texto(inst.hora),duracaoDias:Math.max(1,Math.min(366,Number(inst.duracaoDias)||1)),equipe:Array.isArray(r.equipe)?r.equipe.map(texto):[],veiculo:texto(r.veiculo),liberadoPCP:r.liberadoPCP===true,finalizadaEm:texto(r.finalizadaEm),rev:typeof r.rev==='number'?r.rev:0,versao,dados};
}
export function vinculosConferidos(o:OrdemProgramacao):boolean {const p=o.dados.participantes;return p.length>0&&p.length===o.equipe.length&&p.every(x=>o.equipe.includes(x.nomePCP));}
export function nomesDaEquipe(o:OrdemProgramacao):string[]{return o.equipe.map(n=>o.dados.participantes.find(p=>p.nomePCP===n)?.nome||n);}
export function pendenciasSaida(o:OrdemProgramacao,dia:string,hoje=diaSP()):string[]{
  const p:string[]=[];
  if(!o.liberadoPCP)p.push('Liberação do PCP pendente');
  for(const k of Object.keys(NOMES_REGRAS) as (keyof typeof NOMES_REGRAS)[])if(!o.dados.regras[k])p.push(NOMES_REGRAS[k]);
  if(!o.dados.regras.evidencia.trim())p.push('Referência da conferência comercial');
  if(!vinculosConferidos(o))p.push('Conferir vínculo da equipe com o RH');
  if(!o.veiculo)p.push('Definir veículo');
  if(o.dados.lugares===null)p.push('Conferir lugares do veículo');
  if(o.dados.lugares!==null&&o.equipe.length>o.dados.lugares)p.push('Equipe excede os lugares do veículo');
  if(!o.dados.motoristaId||!o.dados.participantes.some(x=>x.colaboradorId===o.dados.motoristaId))p.push('Definir motorista da equipe');
  if(!o.dados.gerenteId)p.push('Definir gerente responsável');
  if(dia!==hoje||o.dados.confirmado?.dia!==dia||diaSP(new Date(o.dados.confirmado?.em||0))!==dia)p.push('Confirmação com o cliente no dia do serviço');
  return p;
}
export function validarEdicao(e:EdicaoProgramacao):string[]{
  const p:string[]=[];
  if(!e.id||!e.versao)p.push('Atualize a O.S. antes de salvar.');
  if(!dataValida(e.data)||!horaValida(e.hora))p.push('Informe uma data e um horário válidos.');
  if(e.dados.fim&&(!horaValida(e.dados.fim)||e.dados.fim<=e.hora))p.push('A previsão de retorno deve ser depois da saída, no mesmo dia.');
  if(!e.dados.participantes.length)p.push('Escolha pelo menos uma pessoa para a equipe.');
  if(new Set(e.dados.participantes.map(x=>x.colaboradorId)).size!==e.dados.participantes.length)p.push('Uma pessoa não pode aparecer duas vezes.');
  if(new Set(e.dados.participantes.map(x=>x.nomePCP)).size!==e.dados.participantes.length||e.dados.participantes.some(x=>!x.nomePCP.trim()))p.push('Confira o nome de cada participante no PCP, sem repetições.');
  if(e.dados.motoristaId&&!e.dados.participantes.some(x=>x.colaboradorId===e.dados.motoristaId))p.push('O motorista precisa estar na equipe.');
  if(e.dados.lugares!==null&&(!Number.isInteger(e.dados.lugares)||e.dados.lugares<1||e.dados.lugares>60))p.push('Informe entre 1 e 60 lugares, incluindo o motorista.');
  if(e.dados.lugares!==null&&e.dados.participantes.length>e.dados.lugares)p.push('A equipe não cabe no veículo. Ajuste a equipe ou o veículo.');
  if(Object.keys(NOMES_REGRAS).some(k=>e.dados.regras[k as keyof typeof NOMES_REGRAS])&&!e.dados.regras.evidencia.trim())p.push('Registre a referência que comprova a conferência comercial.');
  return p;
}
export function conflitosProgramacao(a:OrdemProgramacao,todas:OrdemProgramacao[]):{id:string;numero:string;motivo:string;certo:boolean}[]{
  const dias=diasDaOrdem(a);return todas.filter(b=>b.id!==a.id&&!b.finalizadaEm&&diasDaOrdem(b).some(d=>dias.includes(d))).flatMap(b=>{
    const nomes=a.equipe.filter(n=>b.equipe.includes(n));const ids=a.dados.participantes.filter(n=>b.dados.participantes.some(x=>x.colaboradorId===n.colaboradorId));
    const carro=!!a.veiculo&&a.veiculo===b.veiculo;if(!carro&&!nomes.length&&!ids.length)return [];
    const definidos=horaValida(a.hora)&&horaValida(b.hora)&&horaValida(a.dados.fim)&&horaValida(b.dados.fim);
    const sobrepoe=definidos?a.hora<b.dados.fim&&b.hora<a.dados.fim:a.hora===b.hora;
    if(definidos&&!sobrepoe)return [];
    return [{id:b.id,numero:b.numero,motivo:[(nomes.length||ids.length)?'pessoa em comum':'',carro?'mesmo veículo':''].filter(Boolean).join(' e '),certo:sobrepoe}];
  });
}
