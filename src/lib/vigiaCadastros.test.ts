import { it, expect, vi } from 'vitest';
import { criarVigiaCadastros } from './vigiaCadastros';
it('recebe o sinal sem recarga, reconfere ao conectar e ignora callbacks da sessão encerrada', async () => {
  const sinais: (()=>void)[] = [], conexoes: ((ok: boolean)=>void)[] = [], limpezas = [vi.fn(),vi.fn()];
  let ativo=true;
  const atualizar=vi.fn(async()=>{});
  const v=criarVigiaCadastros({ atualizar, podeAtualizar:()=>ativo, observar:(sinal,conectado)=> {
    sinais.push(sinal); conexoes.push(conectado); return limpezas[sinais.length-1];
  } });
  v.usuario('a'); conexoes[0](true); await Promise.resolve(); expect(atualizar).toHaveBeenCalledTimes(1);
  sinais[0](); sinais[0](); await Promise.resolve(); expect(atualizar).toHaveBeenCalledTimes(2);
  ativo=false; sinais[0](); await Promise.resolve(); expect(atualizar).toHaveBeenCalledTimes(2);
  ativo=true; v.usuario('b'); sinais[0](); await Promise.resolve(); expect(atualizar).toHaveBeenCalledTimes(2);
  sinais[1](); v.usuario(null); await Promise.resolve(); expect(atualizar).toHaveBeenCalledTimes(2);
  expect(limpezas[0]).toHaveBeenCalledOnce(); expect(limpezas[1]).toHaveBeenCalledOnce();
});

it('refaz o canal interrompido e reconfere sem esperar a consulta periódica', async () => {
  vi.useFakeTimers();
  const conexoes: ((ok: boolean) => void)[] = [];
  const limpar = vi.fn(), atualizar = vi.fn(async () => {});
  const v = criarVigiaCadastros({ atualizar, podeAtualizar: () => true, observar: (_sinal, conectado) => {
    conexoes.push(conectado); return limpar;
  } });
  try {
    v.usuario('ficticio'); conexoes[0](true); await Promise.resolve();
    conexoes[0](false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(conexoes).toHaveLength(2);
    expect(limpar).toHaveBeenCalledOnce();
    conexoes[1](true); await Promise.resolve();
    expect(atualizar).toHaveBeenCalledTimes(2);
    conexoes[1](false); v.usuario(null);
    await vi.advanceTimersByTimeAsync(30000);
    expect(conexoes).toHaveLength(2);
  } finally { v.usuario(null); vi.useRealTimers(); }
});
