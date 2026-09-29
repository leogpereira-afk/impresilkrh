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
  /** Uma chave por entrada da equipe: a PESSOA (colaboradorId), ou "nome:<texto>" quando o nome não leva a ninguém. */
  pessoas?:string[];
  /** Uma por entrada da equipe: o nome para mostrar (nunca o ID cru). */
  rotulos?:string[];
}
export interface EdicaoProgramacao {id:string;versao:string;data:string;hora:string;veiculo:string;dados:DadosProgramacao;confirmar?:{canal:'Telefone'|'WhatsApp';contato:string};desconfirmar?:boolean}
const texto=(v:unknown)=>typeof v==='string'||typeof v==='number'?String(v):'';
const objeto=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export const dadosVazios=():DadosProgramacao=>({participantes:[],fim:'',motoristaId:'',lugares:null,grade:false,gerenteId:'',gerenteNome:'',orientacoes:'',regras:regrasVazias(),atualizadoEm:'',atualizadoPor:''});
export function diaSP(d=new Date()):string {const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);return `${p.find(x=>x.type==='year')?.value}-${p.find(x=>x.type==='month')?.value}-${p.find(x=>x.type==='day')?.value}`;}
export const dataValida=(s:string)=>/^20\d{2}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(`${s}T12:00:00Z`))&&new Date(`${s}T12:00:00Z`).toISOString().slice(0,10)===s;
export const horaValida=(s:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export function diasDaOrdem(o:Pick<OrdemProgramacao,'data'|'duracaoDias'>):string[]{if(!dataValida(o.data))return [];return Array.from({length:Math.max(1,Math.min(366,Math.floor(o.duracaoDias)||1))},(_,i)=>{const d=new Date(`${o.data}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10);});}
/** Pessoa do RH pelo ID (6 primeiros dígitos do CPF): colaboradorId + nome. */
export type PessoaPorId = Map<string,{colaboradorId:string;nome:string;desligado?:boolean}>;
export const ehIdPessoa=(v:unknown)=>/^\d{6}$/.test(String(v??'').trim());
/* A RÉGUA DE PESSOA DO PCP (operacao.js, resolverPessoas), só a parte que o RH
   usa: do nome antigo da equipe ao ID. Mesmo algoritmo e os mesmos casos de
   teste do PCP (tests/pessoas-id.test.cjs lá, programacaoId.test.ts aqui):
   vínculo salvo -- ou a decisão "terceiro, sem ficha" --, depois casamento
   único entre TODAS as fichas, nunca em quem saiu. Mudou lá, muda aqui. */
export type FichaPessoa={id:string;chave:string;nome:string;apelido:string;desligado:boolean};
const normPessoa=(s:unknown)=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const id6=(v:unknown)=>{const d=String(v??'').replace(/\D/g,'');return d.length===6?d:d.length===11?d.slice(0,6):'';};
export function resolverIdPCP(todas:FichaPessoa[],vinculos:unknown):(entrada:string)=>string{
  const fichas=todas.filter(p=>ehIdPessoa(p.id));
  const porId=new Map<string,FichaPessoa>();for(const p of fichas)if(!porId.has(p.id))porId.set(p.id,p);
  const porChave=new Map(fichas.filter(p=>p.chave).map(p=>[p.chave,p] as const));
  const um=(a:FichaPessoa[])=>a.length===1&&!a[0].desligado?a[0]:null;
  const auto=(texto:string)=>{
    const ap=normPessoa(texto),tokens=ap.split(' ');
    const porApelido=fichas.filter(p=>normPessoa(p.apelido)===ap);if(porApelido.length)return um(porApelido);
    const porNome=fichas.filter(p=>normPessoa(p.nome)===ap);if(porNome.length)return um(porNome);
    return um(fichas.filter(p=>{const n=normPessoa(p.nome).split(' ');return tokens.every((t,i)=>n[i]===t);}));
  };
  const salvos=new Map<string,string>();
  for(const v of Array.isArray(vinculos)?vinculos:[]){
    const o=objeto(v),ap=normPessoa(o.apelido||o.nomePCP);
    const p=porId.get(id6(o.id||o.idPessoa))||porChave.get(texto(o.chave).trim());
    const id=o.semFicha===true?'':(p?p.id:id6(o.id||o.idPessoa));
    if(!ap||(!id&&o.semFicha!==true))continue;
    salvos.set(ap,salvos.has(ap)&&salvos.get(ap)!==id?'':id);
  }
  const memo=new Map<string,string>();
  return (entrada:string)=>{
    const s=String(entrada??'').trim();if(!s)return '';if(ehIdPessoa(s))return s;
    const ap=normPessoa(s);if(!memo.has(ap))memo.set(ap,salvos.has(ap)?salvos.get(ap)??'':(auto(s)?.id??''));
    return memo.get(ap)??'';
  };
}
/** O que a projeção precisa saber das pessoas: ID -> ficha, e nome antigo -> ID. */
export interface ContextoPessoas{porId:PessoaPorId;idDe:(entrada:string)=>string}
/** Fichas do RH (id, nome, cpf; direto ou dentro de `registro`) -> ID -> pessoa.
 *  Mesma régua de src/lib/identidade.ts: dois cadastros com o mesmo ID não casam com ninguém. */
export function mapaPessoasPorId(linhas:Record<string,unknown>[]):PessoaPorId{
  const conta=new Map<string,number>(),achadas:{id6:string;colaboradorId:string;nome:string;desligado:boolean}[]=[];
  for(const l of linhas){
    const reg=objeto(l.registro),cpf=texto(l.cpf??reg.cpf).replace(/\D/g,'');
    if(cpf.length!==11||!texto(l.id))continue;
    const id=cpf.slice(0,6);conta.set(id,(conta.get(id)??0)+1);
    achadas.push({id6:id,colaboradorId:texto(l.id),nome:texto(l.nome??reg.nome).trim(),desligado:!!texto(l.dataDesligamento??reg.dataDesligamento).trim()});
  }
  const m:PessoaPorId=new Map();for(const a of achadas)if(conta.get(a.id6)===1)m.set(a.id6,{colaboradorId:a.colaboradorId,nome:a.nome,desligado:a.desligado});
  return m;
}
export function projetarProgramacao(r:Record<string,unknown>,versao:string,ctx?:ContextoPessoas):OrdemProgramacao {
  const porId=ctx?.porId;
  const inst=objeto(r.instalacao), meta=objeto(r.programacaoRH), dados=dadosVazios(), regras=objeto(meta.regras);
  dados.participantes=Array.isArray(meta.participantes)?meta.participantes.map(objeto).filter(p=>texto(p.colaboradorId)).map(p=>({colaboradorId:texto(p.colaboradorId),nome:texto(p.nome),nomePCP:texto(p.nomePCP)})):[];
  for(const k of ['fim','motoristaId','gerenteId','gerenteNome','orientacoes','atualizadoEm','atualizadoPor'] as const)dados[k]=texto(meta[k]);
  dados.lugares=typeof meta.lugares==='number'?meta.lugares:null;dados.grade=meta.grade===true;
  for(const k of Object.keys(NOMES_REGRAS) as (keyof typeof NOMES_REGRAS)[])dados.regras[k]=regras[k]===true;
  dados.regras.evidencia=texto(regras.evidencia);
  const equipe=Array.isArray(r.equipe)?r.equipe.map(texto):[];
  dados.participantes=dados.participantes.filter(p=>equipe.includes(p.nomePCP));
  /* ID DO RH NA EQUIPE (PCP grava o ID desde 29/09/2026, ordem do dono: "usar
     o ID em todo o sistema"). A pessoa já vem ligada: quem está na equipe pelo
     ID e ainda não tem participante ganha o dele, da ficha. */
  if(porId)for(const n of equipe){
    if(!ehIdPessoa(n)||dados.participantes.some(p=>p.nomePCP===n))continue;
    const f=porId.get(n);if(f&&!f.desligado&&!dados.participantes.some(p=>p.colaboradorId===f.colaboradorId))dados.participantes.push({colaboradorId:f.colaboradorId,nome:f.nome,nomePCP:n});
  }
  /* A EQUIPE PELA PESSOA: o nome antigo e o ID da mesma pessoa dão a mesma
     chave (colaboradorId). É ela que diz se a agenda mudou e se há conflito. */
  const pessoas:string[]=[],rotulos:string[]=[];
  for(const n of equipe){
    const part=dados.participantes.find(p=>p.nomePCP===n);
    const id=ehIdPessoa(n)?n:(ctx?ctx.idDe(n):'');
    const f=id?porId?.get(id):undefined;
    pessoas.push(part?.colaboradorId||f?.colaboradorId||`nome:${normPessoa(n)}`);
    rotulos.push(part?.nome||f?.nome||(ehIdPessoa(n)?`ID ${n}`:n));
  }
  if(!dados.participantes.some(p=>p.colaboradorId===dados.motoristaId))dados.motoristaId='';
  let referencia:unknown[]=[];try{const v=JSON.parse(texto(meta.referenciaAgenda));if(Array.isArray(v))referencia=v;}catch{/* legado sem retrato */}
  if(referencia[3]!==texto(r.veiculo)){dados.lugares=null;dados.grade=false;}
  if(referencia[1]!==texto(inst.hora))dados.fim='';
  const conf=objeto(meta.confirmado);
  const assinatura=JSON.stringify([texto(inst.data),texto(inst.hora),Array.isArray(r.equipe)?r.equipe.map(texto):[],texto(r.veiculo)]);
  /* A MESMA AGENDA PELA PESSOA: o PCP trocar "Lucas" pelo ID do mesmo Lucas
     não desfaz a confirmação que o RH registrou com o cliente. */
  const chaveDe=(n:string)=>{const id=ehIdPessoa(n)?n:(ctx?ctx.idDe(n):'');return (id&&porId?.get(id)?.colaboradorId)||(id?`id:${id}`:`nome:${normPessoa(n)}`);};
  const porPessoa=(eq:unknown[])=>[...new Set(eq.map(x=>chaveDe(texto(x))))].sort().join('|');
  const mesmaAgenda=meta.referenciaAgenda===assinatura||(!!ctx&&Array.isArray(referencia[2])&&referencia[0]===texto(inst.data)&&referencia[1]===texto(inst.hora)&&referencia[3]===texto(r.veiculo)&&porPessoa(referencia[2] as unknown[])===porPessoa(equipe));
  if(mesmaAgenda&&Number.isFinite(Date.parse(texto(conf.em)))&&dataValida(texto(conf.dia))&&['Telefone','WhatsApp'].includes(texto(conf.canal)))dados.confirmado={dia:texto(conf.dia),em:texto(conf.em),por:texto(conf.por),canal:conf.canal as 'Telefone'|'WhatsApp',contato:texto(conf.contato)};
  return {id:texto(r.id),numero:texto(r.numero),cliente:texto(r.cliente),servico:texto(r.servico),endereco:texto(r.endereco),data:texto(inst.data),hora:texto(inst.hora),duracaoDias:Math.max(1,Math.min(366,Number(inst.duracaoDias)||1)),equipe:Array.isArray(r.equipe)?r.equipe.map(texto):[],veiculo:texto(r.veiculo),liberadoPCP:r.liberadoPCP===true,finalizadaEm:texto(r.finalizadaEm),rev:typeof r.rev==='number'?r.rev:0,versao,dados,pessoas,rotulos};
}
export function vinculosConferidos(o:OrdemProgramacao):boolean {const p=o.dados.participantes;return p.length>0&&p.length===o.equipe.length&&p.every(x=>o.equipe.includes(x.nomePCP));}
export function nomesDaEquipe(o:OrdemProgramacao):string[]{return o.equipe.map((n,i)=>o.dados.participantes.find(p=>p.nomePCP===n)?.nome||o.rotulos?.[i]||(ehIdPessoa(n)?`ID ${n}`:n));}
/** A equipe pela PESSOA: o nome antigo e o ID da mesma pessoa são iguais aqui. */
export function pessoasDaEquipe(o:OrdemProgramacao):string[]{return o.equipe.map((n,i)=>o.dados.participantes.find(p=>p.nomePCP===n)?.colaboradorId||o.pessoas?.[i]||`nome:${normPessoa(n)}`);}
export function equipeCanonica(o:OrdemProgramacao):string[]{return [...new Set(pessoasDaEquipe(o))].sort();}
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
    const pb=pessoasDaEquipe(b);const nomes=pessoasDaEquipe(a).filter(k=>pb.includes(k));const ids=a.dados.participantes.filter(n=>b.dados.participantes.some(x=>x.colaboradorId===n.colaboradorId));
    const carro=!!a.veiculo&&a.veiculo===b.veiculo;if(!carro&&!nomes.length&&!ids.length)return [];
    const definidos=horaValida(a.hora)&&horaValida(b.hora)&&horaValida(a.dados.fim)&&horaValida(b.dados.fim);
    const sobrepoe=definidos?a.hora<b.dados.fim&&b.hora<a.dados.fim:a.hora===b.hora;
    if(definidos&&!sobrepoe)return [];
    return [{id:b.id,numero:b.numero,motivo:[(nomes.length||ids.length)?'pessoa em comum':'',carro?'mesmo veículo':''].filter(Boolean).join(' e '),certo:sobrepoe}];
  });
}
