import { it, expect, vi } from 'vitest';
import { criarVigiaCadastros } from './vigiaCadastros';
it('recebe o sinal sem recarga, reconfere ao conectar e ignora callbacks da sessão encerrada', async () => {
  const sinais: (()=>void)[] = [], conexoes: (()=>void)[] = [], limpezas = [vi.fn(),vi.fn()];
  let ativo=true;
  const atualizar=vi.fn(async()=>{});
  const v=criarVigiaCadastros({ atualizar, podeAtualizar:()=>ativo, observar:(sinal,conectado)=> {
    sinais.push(sinal); conexoes.push(conectado); return limpezas[sinais.length-1];
  } });
  v.usuario('a'); conexoes[0](); await Promise.resolve(); expect(atualizar).toHaveBeenCalledTimes(1);
  sinais[0](); sinais[0](); await Promise.resolve(); expect(atualizar).toHaveBeenCalledTimes(2);
  ativo=false; sinais[0](); await Promise.resolve(); expect(atualizar).toHaveBeenCalledTimes(2);
  ativo=true; v.usuario('b'); sinais[0](); await Promise.resolve(); expect(atualizar).toHaveBeenCalledTimes(2);
  sinais[1](); v.usuario(null); await Promise.resolve(); expect(atualizar).toHaveBeenCalledTimes(2);
  expect(limpezas[0]).toHaveBeenCalledOnce(); expect(limpezas[1]).toHaveBeenCalledOnce();
});
