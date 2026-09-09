// Navegação isolada: toda chamada externa recebe dados fictícios ou é bloqueada.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.RH_PREVIEW || 'http://127.0.0.1:4182/impresilkrh';
const pasta = process.env.RH_AUDIT_OUTPUT || '/tmp/rh-auditoria-telas';
await fs.mkdir(pasta, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, headless: true });
const agora = new Date().toISOString();
for (const [perfil, telas] of Object.entries({ADMIN_RH:["ferias"]})) for (const width of [320,390,768,1440]) {
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
    pagamentos: Array.from({length:16},(_,i)=>({id:`mubi-${90000+i}`,idMubi:String(90000+i),colaboradorId:i%2?'bia':'ana',competencia:`2026-${String(1+Math.floor(i/2)).padStart(2,'0')}`,tipo:'Salário',valor:1800+i*10,dataPagamento:`2026-${String(2+Math.floor(i/2)).padStart(2,'0')}-05`,pagoEm:`2026-${String(2+Math.floor(i/2)).padStart(2,'0')}-05`,statusErp:'PAGO'})),
    ferias:[{id:'f-antiga',colaboradorId:'ana',periodoAquisitivoInicio:'2024-02-01',periodoAquisitivoFim:'2025-01-31',dataInicio:'2025-09-01',dataRetorno:'2025-10-01',diasGozados:30,saldoDias:0,direitoDias:30,abonoDias:0,status:'Concluída'},{id:'f-reserva',colaboradorId:'ana',periodoAquisitivoInicio:'2025-02-01',periodoAquisitivoFim:'2026-01-31',dataInicio:'2026-10-01T12:00:00.000Z',dataRetorno:'2026-10-21T12:00:00.000Z',diasGozados:20,saldoDias:10,direitoDias:30,abonoDias:0,status:'Agendada'}],
    tarefas:[{id:'t1',titulo:'Conferir integração de demonstração',colaboradorId:'ana',tipo:'Admissão',ordem:0,concluida:false,data:agora.slice(0,10)},{id:'t2',titulo:'Apresentação Bia',colaboradorId:'bia',tipo:'Admissão',ordem:0,concluida:false}],
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
  await page.clock.install({time:new Date('2026-09-09T12:00:00-03:00')});


  await page.goto(`${base}/ferias`,{waitUntil:'networkidle'});
  const ler=()=>page.evaluate(()=>new Promise((resolve,reject)=>{
    const req=indexedDB.open('impresilk.rh.dados',1);
    req.onerror=()=>reject(req.error);
    req.onsuccess=()=>{const db=req.result;const r=db.transaction('chaves','readonly').objectStore('chaves').get('impresilk.rh.v1:col:ferias:conta:ana:ADMIN_RH');r.onsuccess=()=>{db.close();resolve(JSON.parse(r.result||'[]'));};r.onerror=()=>reject(r.error);};
  }));
  const largura=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,'Página sem vazamento lateral');
  assert.equal((await ler()).length,2,'Visita não grava férias');
  assert.ok(await page.getByRole('button',{name:'Programar férias de Bia — demonstração',exact:true}).isVisible(),'Pessoa sem histórico aparece');
  assert.ok((await page.locator('main').innerText()).includes('10 dias livres'));
  await largura();
  await page.screenshot({path:`${pasta}/rh-ferias-${width}-lista.png`,fullPage:true});
  await page.getByRole('button',{name:'Ver férias de Ana — demonstração',exact:true}).click();
  assert.ok((await page.locator('main').innerText()).includes('20 agendados'));
  await largura();
  await page.getByRole('button',{name:'Programar férias de Ana — demonstração',exact:true}).click();
  let modal=page.getByRole('dialog');
  await modal.getByLabel('Início do gozo',{exact:true}).fill('2026-11-01');
  await modal.getByLabel('Duração do gozo (dias)',{exact:true}).fill('20');
  await modal.getByRole('checkbox').check();
  await modal.getByRole('button',{name:'Salvar férias',exact:true}).click();
  assert.ok((await modal.getByRole('alert').innerText()).includes('ultrapassam'));
  assert.equal((await ler()).length,2,'Reserva acima do saldo não grava');
  await page.screenshot({path:`${pasta}/rh-ferias-${width}-bloqueio.png`,fullPage:true});
  await modal.getByLabel('Duração do gozo (dias)',{exact:true}).fill('10');
  await modal.getByRole('button',{name:'Salvar férias',exact:true}).click();
  await page.waitForTimeout(250);
  let gravadas=await ler();
  assert.equal(gravadas.length,3);
  const criada=gravadas.find(f=>!['f-antiga','f-reserva'].includes(f.id));
  assert.equal(criada.dataRetorno,'2026-11-11');
  assert.equal(criada.abonoDias,0);assert.equal(criada.direitoDias,30);
  assert.equal(criada.status,'Agendada');assert.equal(criada.diasGozados,0);assert.equal(criada.saldoDias,0);
  assert.ok((await page.locator('main').innerText()).includes('0 dias livres'));
  // Navegação SPA mantém a mesma coleção: ficha enxerga exatamente o novo lançamento.
  await page.getByRole('link',{name:'Ana — demonstração',exact:true}).first().click();
  await page.getByRole('tab',{name:'Férias',exact:true}).click();
  assert.ok((await page.locator('main').innerText()).includes('30 agendados'));
  await largura();
  await page.screenshot({path:`${pasta}/rh-ferias-${width}-ficha.png`,fullPage:true});
  await page.getByRole('button',{name:'Novo período',exact:true}).click();
  modal=page.getByRole('dialog');
  await modal.getByLabel('Aquisitivo — início',{exact:true}).fill('2025-02-01');
  await modal.getByLabel('Aquisitivo — fim',{exact:true}).fill('2026-01-31');
  await modal.getByLabel('Início do gozo',{exact:true}).fill('2026-12-01');
  await modal.getByLabel('Duração do gozo (dias)',{exact:true}).fill('5');
  await modal.getByRole('checkbox').check();
  await modal.getByRole('button',{name:'Salvar férias',exact:true}).click();
  assert.ok((await modal.getByRole('alert').innerText()).includes('ultrapassam'));
  assert.equal((await ler()).length,3,'Ficha usa a mesma validação da agenda');
  await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
  // Localiza pela data do gozo, sem depender da ordem dos períodos.
  await page.locator('button[title="Editar este período / agendar o gozo"]').filter({hasText:'01/10/2026'}).click();
  modal=page.getByRole('dialog');
  await modal.getByLabel('Situação das férias').selectOption('Cancelada');
  await modal.getByRole('button',{name:'Salvar férias',exact:true}).click();
  await page.waitForTimeout(250);
  gravadas=await ler();
  const cancelada=gravadas.find(f=>f.id==='f-reserva');
  assert.equal(cancelada.status,'Cancelada');
  assert.equal(cancelada.dataInicio,'2026-10-01T12:00:00.000Z','Cancelar preserva a data antiga');
  assert.equal(cancelada.diasGozados,20,'Cancelar altera apenas a decisão');
  assert.ok((await page.locator('main').innerText()).includes('20 dias livres'));
  assert.deepEqual(erros,[]);
  await context.close();
}
await browser.close();
console.log('PASS: 320, 390, 768 e 1440px; sem gravação na visita; sem histórico visível; reserva futura bloqueada; fração válida persistida; ficha integrada; cancelamento preserva dados e libera saldo; sem erros de navegador.');
