// Porta de programação do RH. Só altera a agenda de O.S. existentes, por ação
// explícita do ADMIN_RH. Não cria O.S., não libera carros, não grava folha.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, preflight } from '../_shared/cors.ts';
import { projetarProgramacao, validarEdicao, diasDaOrdem, diaSP, conflitosProgramacao } from '../_shared/programacao.ts';
import type { EdicaoProgramacao, DadosProgramacao } from '../_shared/programacao.ts';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const texto=(v:unknown,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
async function lerOrdens(){
  const linhas:{id:string;registro:Record<string,unknown>;atualizado_em:string}[]=[];let depois='';
  for(let pagina=0;;pagina++){
    if(pagina>=100)throw new Error('Consulta muito extensa. Nenhum resultado parcial foi usado.');
    let q=admin.from('pcp_registros').select('id,registro,atualizado_em').eq('colecao','os').eq('apagado',false).order('id').limit(500);
    if(depois)q=q.gt('id',depois);
    const {data,error}=await q;if(error)throw new Error('Não foi possível consultar o PCP.');
    linhas.push(...data??[]);if(!data||data.length<500)break;depois=data[data.length-1].id;
  }return linhas;
}
Deno.serve(async(req:Request)=>{
  const pre=preflight(req);if(pre)return pre;
  if(req.method!=='POST')return json({erro:'Use POST.'},405);
  try{
    const token=req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];if(!token)return json({erro:'Entre no RH.'},401);
    const {data:auth,error:ea}=await admin.auth.getUser(token);if(ea||!auth.user)return json({erro:'Entre novamente no RH.'},401);
    const {data:perfil,error:ep}=await admin.from('perfis').select('colaborador_id,perfil,ativo').eq('user_id',auth.user.id).maybeSingle();
    if(ep||!perfil?.colaborador_id||perfil.ativo===false)return json({erro:'Acesso indisponível.'},401);
    if(perfil.perfil!=='ADMIN_RH')return json({erro:'Programação restrita à administração do RH.'},403);
    let body;try{const raw=await req.text();if(raw.length>24000)return json({erro:'Pedido muito extenso.'},413);body=JSON.parse(raw);}catch{return json({erro:'Pedido inválido.'},400);}
    if(!['listar','salvar'].includes(body?.action))return json({erro:'Ação inválida.'},400);
    const {data:cfg,error:ec}=await admin.from('pcp_config_global').select('config').maybeSingle();if(ec)throw new Error('Não foi possível consultar os cadastros do PCP.');
    const instaladores=Array.isArray(cfg?.config?.instaladores)?cfg.config.instaladores.filter((x:unknown)=>typeof x==='string'):[];
    const veiculos=Array.isArray(cfg?.config?.veiculos)?cfg.config.veiculos.filter((x:unknown)=>typeof x==='string'):[];
    if(body.action==='listar'){
      if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(body.mes??''))return json({erro:'Mês inválido.'},400);
      const ordens=(await lerOrdens()).map(l=>projetarProgramacao({...l.registro,id:l.id},l.atualizado_em)).filter(o=>!o.finalizadaEm||diasDaOrdem(o).some(d=>d.startsWith(body.mes)));
      return json({ordens,instaladores,veiculos,consultadoEm:new Date().toISOString()});
    }
    const v=body.edicao;if(!v||typeof v!=='object'||!v.dados||!Array.isArray(v.dados.participantes)||v.dados.participantes.length>60)return json({erro:'Programação inválida.'},400);
    const {data:atual,error:el}=await admin.from('pcp_registros').select('id,registro,atualizado_em').eq('colecao','os').eq('id',texto(v.id,150)).eq('apagado',false).maybeSingle();
    if(el)throw new Error('Não foi possível conferir a O.S.');
    if(!atual)return json({erro:'O.S. não encontrada. Atualize a lista.'},404);
    if(atual.registro.finalizadaEm)return json({erro:'A O.S. foi concluída. A programação permanece no histórico.'},409);
    if(atual.atualizado_em!==v.versao)return json({erro:'Esta O.S. mudou no PCP. Atualize a lista e confira novamente.'},409);
    const {data:pessoas,error:er}=await admin.from('registros').select('id,registro').eq('colecao','colaboradores').eq('apagado',false).in('id',[...v.dados.participantes.map((p:Record<string,unknown>)=>texto(p?.colaboradorId,150)),texto(v.dados.gerenteId,150),perfil.colaborador_id]);
    if(er)throw new Error('Não foi possível conferir as pessoas do RH.');
    const porId=new Map((pessoas??[]).map(p=>[p.id,p.registro]));
    const participantes=[];
    for(const p of v.dados.participantes){
      const id=texto(p?.colaboradorId,150), pessoa=porId.get(id);
      if(!pessoa||pessoa.dataDesligamento||pessoa.statusId==='inativo')return json({erro:'Uma pessoa não está disponível no cadastro. Confira a equipe.'},400);
      const nome=texto(pessoa.nome,180), nomePCP=texto(p.nomePCP,180);
      if(nomePCP!==nome&&!instaladores.includes(nomePCP))return json({erro:'Selecione o nome cadastrado no PCP ou o nome completo do colaborador.'},400);
      participantes.push({colaboradorId:id,nome,nomePCP});
    }
    const regras={osValidada:v.dados.regras?.osValidada===true,prazoAcordado:v.dados.regras?.prazoAcordado===true,dossieCompleto:v.dados.regras?.dossieCompleto===true,exportacaoTotal:v.dados.regras?.exportacaoTotal===true,diretorLiberou:v.dados.regras?.diretorLiberou===true,evidencia:texto(v.dados.regras?.evidencia,1500)};
    const gerenteId=texto(v.dados.gerenteId,150);if(gerenteId&&!porId.has(gerenteId))return json({erro:'Gerente não encontrado no RH.'},400);
    const agora=new Date().toISOString(), antigo=projetarProgramacao({...atual.registro,id:atual.id},atual.atualizado_em);
    const dados:DadosProgramacao={participantes,fim:texto(v.dados.fim,5),motoristaId:texto(v.dados.motoristaId,150),lugares:v.dados.lugares===null?null:Number(v.dados.lugares),grade:v.dados.grade===true,gerenteId,gerenteNome:texto(porId.get(gerenteId)?.nome,180),orientacoes:texto(v.dados.orientacoes,2000),regras,atualizadoEm:agora,atualizadoPor:perfil.colaborador_id};
    const edicao:EdicaoProgramacao={id:atual.id,versao:atual.atualizado_em,data:texto(v.data,10),hora:texto(v.hora,5),veiculo:texto(v.veiculo,100),dados};
    const erros=validarEdicao(edicao);if(erros.length)return json({erro:erros.join(' ')},400);
    const assinatura=(o:typeof antigo)=>JSON.stringify([o.data,o.hora,o.veiculo,o.equipe,o.dados.participantes,o.dados.fim,o.dados.motoristaId,o.dados.lugares,o.dados.gerenteId,o.dados.regras]);
    const candidata={...antigo,...edicao,equipe:participantes.map(p=>p.nomePCP)};
    const agendaMudou=JSON.stringify([antigo.data,antigo.hora,antigo.equipe,antigo.veiculo])!==JSON.stringify([candidata.data,candidata.hora,candidata.equipe,candidata.veiculo]);
    if(agendaMudou&&(atual.registro.carroLiberado||atual.registro.horaSaida))return json({erro:'Esta O.S. já tem saída registrada. Confira e reabra a programação no PCP antes de remarcar.'},409);
    if(assinatura(antigo)===assinatura(candidata)&&!v.desconfirmar)dados.confirmado=antigo.dados.confirmado;
    if(v.confirmar){
      const hoje=diaSP();
      if(!diasDaOrdem(candidata).includes(hoje))return json({erro:'A confirmação só pode ser registrada no dia do serviço.'},400);
      if(!['Telefone','WhatsApp'].includes(v.confirmar.canal)||!texto(v.confirmar.contato,180))return json({erro:'Informe o canal e quem confirmou com você.'},400);
      dados.confirmado={dia:hoje,em:agora,por:perfil.colaborador_id,canal:v.confirmar.canal,contato:texto(v.confirmar.contato,180)};
    }
    const outras=(await lerOrdens()).map(l=>projetarProgramacao({...l.registro,id:l.id},l.atualizado_em));
    const conflitos=conflitosProgramacao(candidata,outras);
    if(conflitos.some(c=>c.certo))return json({erro:`Equipe ou veículo já ocupado no horário: O.S. ${conflitos.filter(c=>c.certo).map(c=>c.numero).join(', ')}. Ajuste a programação.`},409);
    const reg=atual.registro;
    const confirmacaoPCP=v.confirmar&&dados.confirmado?{confirmacao:'Confirmado',confCanal:dados.confirmado.canal,confHora:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(agora)),confPor:texto(porId.get(perfil.colaborador_id)?.nome,180)||`RH · ${perfil.colaborador_id}`,confObs:`Confirmado com ${dados.confirmado.contato} em ${dados.confirmado.dia} pelo RH.`}:agendaMudou||v.desconfirmar?{confirmacao:'',confCanal:'',confHora:'',confPor:''}:{};
    // Mescla sobre o retrato do servidor. Campos comerciais, financeiros, de
    // execução, fotos e liberação do PCP não são aceitos do cliente. A confirmação
    // é construída acima, com data e autor conferidos no servidor.
    const registro={...reg,...confirmacaoPCP,instalacao:{...(reg.instalacao as object??{}),data:edicao.data,hora:edicao.hora,periodo:edicao.hora<'12:00'?'Manhã':'Tarde'},equipe:candidata.equipe,veiculo:edicao.veiculo,programacaoRH:{...dados,referenciaAgenda:JSON.stringify([edicao.data,edicao.hora,candidata.equipe,edicao.veiculo])},rev:antigo.rev+1,atualizadoEm:agora,atualizadoPor:`RH · ${perfil.colaborador_id}`};
    // Compare-and-swap atômico: não ressuscita O.S. nem sobrescreve uma gravação
    // que ocorreu entre a leitura e este UPDATE. Nenhum upsert/create/delete.
    const {data:salvo,error:es}=await admin.from('pcp_registros').update({registro,atualizado_em:agora}).eq('colecao','os').eq('id',atual.id).eq('apagado',false).eq('atualizado_em',atual.atualizado_em).select('id,registro,atualizado_em').maybeSingle();
    if(es)throw new Error('Não foi possível salvar. Atualize a lista para conferir antes de repetir.');
    if(!salvo)return json({erro:'A O.S. mudou durante a gravação. Atualize e confira novamente.'},409);
    return json({ordem:projetarProgramacao({...salvo.registro,id:salvo.id},salvo.atualizado_em),consultadoEm:agora});
  }catch{return json({erro:'Não foi possível concluir a operação. Atualize o PCP e tente novamente.'},500);}
});
