// Consulta independente, SOMENTE LEITURA. Não substitui o sync do RH,
// não cria registros, não altera permissões e não executa pagamentos.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, preflight } from '../_shared/cors.ts';
import { projetarOrdem } from '../_shared/performanceOS.ts';

const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async(req:Request)=>{
  const pre=preflight(req);
  if(pre)return pre;
  if(req.method!=='POST')return json({erro:'Use POST.'},405);
  try {
    // Verifica o token no Supabase Auth e consulta o perfil ativo a cada pedido.
    // Não confia em perfil, usuário ou equipe enviados pelo navegador.
    const token=(req.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i)?.[1];
    if(!token)return json({erro:'Não autorizado.'},401);
    const {data:auth,error:erroAuth}=await admin.auth.getUser(token);
    if(erroAuth||!auth?.user)return json({erro:'Não autorizado.'},401);
    const {data:perfil,error:erroPerfil}=await admin.from('perfis').select('colaborador_id,perfil,ativo').eq('user_id',auth.user.id).maybeSingle();
    if(erroPerfil||!perfil?.colaborador_id||perfil.ativo===false)return json({erro:'Não autorizado.'},401);
    if(perfil.perfil!=='ADMIN_RH')return json({erro:'Entregas para bonificação são restritas ao RH.'},403);
    let body:Record<string,unknown>;
    try{body=await req.json();}catch{return json({erro:'Pedido inválido.'},400);}
    const competencia=String(body?.competencia??'');
    if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(competencia))return json({erro:'Mês inválido.'},400);
    const ordens:ReturnType<typeof projetarOrdem>[]=[];
    let depois='';
    for(let pagina=0;;pagina++){
      if(pagina>=100)throw new Error('A consulta atingiu o limite de segurança. Nenhum resultado parcial foi utilizado.');
      let query=admin.from('pcp_registros').select('id,registro,atualizado_em').eq('colecao','os').eq('apagado',false).order('id').limit(500);
      if(depois)query=query.gt('id',depois);
      const {data,error}=await query;
      if(error)throw new Error('Não foi possível consultar as entregas do PCP.');
      for(const linha of data??[]){
        const os=projetarOrdem({...linha.registro,id:linha.id},linha.atualizado_em);
        if(os.finalizadaEm.startsWith(competencia))ordens.push(os);
      }
      if(!data||data.length<500)break;
      depois=data[data.length-1].id;
    }
    return json({ordens:ordens.sort((a,b)=>b.finalizadaEm.localeCompare(a.finalizadaEm)),consultadoEm:new Date().toISOString()});
  }catch(e){return json({erro:e instanceof Error?e.message:'Não foi possível consultar as entregas.'},500);}
});
