// Navegação isolada: toda chamada externa recebe dados fictícios ou é bloqueada.
import fs from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.RH_PREVIEW || 'http://127.0.0.1:4182/impresilkrh';
const pasta = process.env.RH_AUDIT_OUTPUT || '/tmp/rh-auditoria-telas';
await fs.mkdir(pasta, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const rotas = ['painel','calendario','colaboradores','colaboradores/ana','organograma','cargos','carreira','desempenho','feedback','comportamental','custos','treinamento','ponto','ferias','integracao','vagas','freelancers','folha-variavel','comunicacao','mensagens','pops','mural-vagas','documentos','sst','meu-perfil','aceites','relatorios','painel-controle','lgpd'];
const grupos = { ADMIN_RH: rotas, GESTOR: ['painel','colaboradores','colaboradores/ana','ponto','ferias','treinamento','desempenho','feedback','folha-variavel','sst','integracao'], COLABORADOR: ['painel','calendario','organograma','carreira','comunicacao','meu-perfil','aceites','documentos'] };
const resultados = [];
const agora = new Date().toISOString();
for (const [perfil, telas] of Object.entries(grupos)) for (const width of [1440,390]) {
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1100 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', serviceWorkers: 'block' });
  const userId = '00000000-0000-4000-8000-000000000001';
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'ana@rh-teste.invalid', app_metadata: {}, user_metadata: {}, created_at: agora };
  const token = [Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:userId,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+7200})).toString('base64url'),'assinatura-ficticia'].join('.');
  const dados = {
    colaboradores: [{id:'ana',nome:'Ana — demonstração',areaId:'teste',cargoId:'cargo-teste',nivelId:'N1',statusId:'ativo',dataAdmissao:'2025-02-01',salario:1000,apelido:'ana'}, {id:'bia',nome:'Bia — demonstração',areaId:'teste',cargoId:'cargo-teste',nivelId:'N1',statusId:'ativo',gestorId:'ana',dataAdmissao:'2025-02-01',salario:1000}],
    usuarios: [{id:'usuario-ana',colaboradorId:'ana',perfil,ativo:true}],
    areas:[{id:'teste',nome:'Equipe de demonstração',ordem:1}],
    cargos:[{id:'cargo-teste',nome:'Cargo de demonstração',areaId:'teste',faixas:[1000,1200,1400,1600,1800]}],
    niveis:[{id:'N1',codigo:'N1',nome:'Inicial',ordem:1,senioridade:'Inicial'}],
    status:[{id:'ativo',nome:'Ativo',cor:'#16803c',contaComoAtivo:true,ordem:1}],
    tarefas:[{id:'t1',titulo:'Conferir integração de demonstração',colaboradorId:'ana',concluida:false,data:agora.slice(0,10)}],
  };
  await context.addInitScript(({perfil,user,token,dados,agora})=>{
    localStorage.setItem('impresilk.rh.v1:sessao',JSON.stringify({perfil,colaboradorId:'ana',visto:Date.now()}));
    localStorage.setItem('sb-heveemylixartyijxewh-auth-token',JSON.stringify({access_token:token,refresh_token:'ficticio',token_type:'bearer',expires_in:7200,expires_at:Math.floor(Date.now()/1000)+7200,user}));
    for(const [nome,registros] of Object.entries(dados)) localStorage.setItem(`impresilk.rh.v1:col:${nome}:conta:ana:${perfil}`,JSON.stringify(registros.map(r=>({...r,atualizadoEm:agora}))));
  },{perfil,user,token,dados,agora});
  const requisicoes = [];
  await context.route('**/*', async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===new URL(base).origin) return route.continue();
    requisicoes.push({path:url.pathname,method:req.method()});
    let body={}; try{body=req.postDataJSON()||{};}catch{}
    let resposta;
    if(url.pathname==='/rest/v1/perfis') resposta={user_id:userId,colaborador_id:'ana',perfil,ativo:true};
    else if(url.pathname.startsWith('/auth/v1/')) resposta=url.pathname.endsWith('/user')?user:{access_token:token,refresh_token:'ficticio',expires_in:7200,token_type:'bearer',user};
    else if(url.pathname==='/functions/v1/sync') {
      if(body.action==='rev') resposta={rev:1,porColecao:Object.fromEntries(Object.keys(dados).map(k=>[k,1]))};
      else if(body.action==='list') resposta={registros:Object.entries(dados).filter(([c])=>!body.colecoes||body.colecoes.includes(c)).flatMap(([colecao,rs])=>rs.map(registro=>({colecao,registro:{...registro,atualizadoEm:agora}}))),nextAfter:null,total:10};
      else if(body.action==='getCfg') resposta={config:null};
      else if(body.action==='ping') resposta={ok:true};
      else resposta={ok:false,erro:'Escrita bloqueada no ensaio visual'};
    } else return route.fulfill({status:204,body:''});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(resposta)});
  });
  const page=await context.newPage(); let erros=[];
  page.on('pageerror',e=>erros.push(e.message));
  for(const rota of telas){
    erros=[]; let falha=null;
    try { await page.goto(`${base}/${rota}`,{waitUntil:'networkidle',timeout:20000}); await page.locator('main').waitFor({timeout:8000}); await page.waitForTimeout(180); }
    catch(e){falha=e.message.split('\n')[0];}
    const medida=await page.evaluate(()=>({largura:innerWidth,conteudo:document.documentElement.scrollWidth,titulo:document.querySelector('h1')?.textContent||'',texto:document.querySelector('main')?.innerText.slice(0,160)||'',quebras:[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.right>innerWidth+2&&s.position!=='fixed';}).slice(0,5).map(e=>({tag:e.tagName,classe:e.className,texto:e.textContent?.slice(0,70)}))}));
    const arquivo=`${perfil.toLowerCase()}-${width}-${rota.replaceAll('/','-')}.png`;
    await page.screenshot({path:path.join(pasta,arquivo),fullPage:true});
    resultados.push({perfil,width,rota,...medida,erros:[...new Set(erros)],falha,arquivo});
    await fs.writeFile(path.join(pasta,'resultado.json'),JSON.stringify(resultados,null,2));
  }
  await context.close();
}
await browser.close();
console.log(JSON.stringify({telas:resultados.length,quebras:resultados.filter(r=>r.conteudo>r.largura+2).length,erros:resultados.filter(r=>r.erros.length||r.falha).length,pasta}));
