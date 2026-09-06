import { beforeEach, afterEach, expect, it, vi } from 'vitest';
beforeEach(()=>{localStorage.clear();vi.resetModules();});
afterEach(()=>{vi.restoreAllMocks();localStorage.clear();});
async function preparar(){const s=await import('./session');s.entrar('ADMIN_RH','ana');return import('./store');}
it('recusa arquivo de outro sistema e registros duplicados antes de importar',async()=>{
  const d=await preparar();
  expect(()=>d.importarDados(JSON.stringify({app:'outro-sistema',dados:{tarefas:[]}}))).toThrow();
  expect(()=>d.importarDados(JSON.stringify({app:'impresilk-rh',dados:{tarefas:[{id:'a'},{id:'a'}]}}))).toThrow();
});
it('a mesma quantidade pode esconder saídas, entradas e edições',async()=>{
  const d=await preparar();d.definirColecaoDinamica('tarefas',[{id:'a',titulo:'Antes'},{id:'b',titulo:'Sair'}]);
  const r=d.analisarBackup(JSON.stringify({app:'impresilk-rh',dados:{tarefas:[{id:'a',titulo:'Depois'},{id:'c',titulo:'Entrar'}]}}));
  expect(r.perdaTotal).toBe(1);expect(r.ganhoTotal).toBe(1);expect(r.linhas[0].alterados).toBe(1);
});
it('falha de espaço no meio da importação mantém todas as coleções anteriores',async()=>{
  const d=await preparar();d.definirColecaoDinamica('tarefas',[{id:'a',titulo:'Antes'}]);d.definirColecaoDinamica('eventos',[{id:'e',titulo:'Evento anterior'}]);
  const set=Storage.prototype.setItem;
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,k:string,v:string){if(k.includes(':col:eventos:')&&v.includes('novo'))throw new Error('quota fictícia');return set.call(this,k,v);});
  expect(()=>d.importarDados(JSON.stringify({app:'impresilk-rh',dados:{tarefas:[{id:'novo'}],eventos:[{id:'novo'}]}}))).toThrow();
  expect(d.obter('tarefas')[0].id).toBe('a');expect(d.obter('eventos')[0].id).toBe('e');
});
it('coleção omitida e configuração omitida permanecem intactas',async()=>{
  const d=await preparar();d.definirColecaoDinamica('tarefas',[{id:'a'}]);const config=d.obterConfig();
  d.importarDados(JSON.stringify({app:'impresilk-rh',dados:{eventos:[]}}));
  expect(d.obter('tarefas')[0].id).toBe('a');expect(d.obterConfig()).toEqual(config);
});
