// Porta de programação do RH, SOMENTE LEITURA desde 29/09/2026 (F02): lista a
// agenda das O.S. do PCP para o ADMIN_RH. Não cria, não altera e não apaga O.S.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, preflight } from '../_shared/cors.ts';
import { projetarProgramacao, diasDaOrdem, mapaPessoasPorId, resolverIdPCP } from '../_shared/programacao.ts';
import type { ContextoPessoas, FichaPessoa } from '../_shared/programacao.ts';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
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
/* A equipe do PCP grava o ID do RH (6 primeiros dígitos do CPF) desde
   29/09/2026; a O.S. antiga guarda o nome. Aqui sai o contexto para ler as
   duas pela PESSOA: ID -> ficha e nome antigo -> ID, com a régua do PCP e os
   vínculos que o PCP salvou. O CPF vira o ID sem sair da porta. Se as fichas
   não vierem, a lista sai sem a ligação automática (e diz no console), em
   vez de não sair. */
async function lerPessoas(vinculos:unknown):Promise<ContextoPessoas>{
  const {data,error}=await admin.from('registros').select('id,registro->>nome,registro->>apelido,registro->>cpf,registro->>dataDesligamento').eq('colecao','colaboradores').eq('apagado',false);
  if(error){console.warn('rh-programacao: fichas do RH indisponíveis',error.message);return {porId:new Map(),idDe:()=>''};}
  const linhas=(data??[]) as Record<string,unknown>[];
  const campo=(l:Record<string,unknown>,k:string)=>String(l[k]??(l.registro as Record<string,unknown>|undefined)?.[k]??'');
  const fichas:FichaPessoa[]=linhas.map(l=>{const d=campo(l,'cpf').replace(/\D/g,'');return {id:d.length===11?d.slice(0,6):'',chave:String(l.id??''),nome:campo(l,'nome').trim(),apelido:campo(l,'apelido').trim(),desligado:!!campo(l,'dataDesligamento').trim()};});
  return {porId:mapaPessoasPorId(linhas),idDe:resolverIdPCP(fichas,vinculos)};
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
    /* A PORTA DE GRAVAR FECHOU (F02, 29/09/2026). A tela de Programação saiu
       do calendário do RH em 13/09 (decisão do dono) e a equipe, o veículo e o
       horário da O.S. passaram a ser lançados só no PCP, dentro da O.S., com
       diário de auditoria e divisão por percentual. Gravar daqui trocaria a
       equipe por fora dessa conta, sem log e sem percentuais. Por isso o
       'salvar' responde 410 (recurso retirado) ANTES de ler qualquer coisa do
       PCP: nenhuma consulta, nenhum UPDATE em pcp_registros. A leitura
       ('listar') continua. As regras de conflito de horário e de 'retorno depois
       da saída' ficam em _shared/programacao.ts como referência para o PCP. */
    if(body?.action==='salvar')return json({erro:'A programação agora é feita no PCP, dentro da O.S. O RH só consulta. Abra o PCP para mudar equipe, veículo ou horário.'},410);
    if(body?.action!=='listar')return json({erro:'Ação inválida.'},400);
    const {data:cfg,error:ec}=await admin.from('pcp_config_global').select('config').maybeSingle();if(ec)throw new Error('Não foi possível consultar os cadastros do PCP.');
    const instaladores=Array.isArray(cfg?.config?.instaladores)?cfg.config.instaladores.filter((x:unknown)=>typeof x==='string'):[];
    const vinculosPCP=Array.isArray(cfg?.config?.vinculosRH)?cfg.config.vinculosRH:[];
    const veiculos=Array.isArray(cfg?.config?.veiculos)?cfg.config.veiculos.filter((x:unknown)=>typeof x==='string'):[];
    if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(body.mes??''))return json({erro:'Mês inválido.'},400);
    const ctx=await lerPessoas(vinculosPCP);
    const ordens=(await lerOrdens()).map(l=>projetarProgramacao({...l.registro,id:l.id},l.atualizado_em,ctx)).filter(o=>!o.finalizadaEm||diasDaOrdem(o).some(d=>d.startsWith(body.mes)));
    return json({ordens,instaladores,veiculos,consultadoEm:new Date().toISOString()});
  }catch{return json({erro:'Não foi possível concluir a operação. Atualize o PCP e tente novamente.'},500);}
});
