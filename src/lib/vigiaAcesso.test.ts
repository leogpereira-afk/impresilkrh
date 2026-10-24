import { expect, it, vi } from 'vitest';
import { criarVigiaAcesso } from './vigiaAcesso';
function montar() {
  let sinal = () => {}, status = (_ok: boolean) => {};
  const d = { consultar: vi.fn(async (_id: string): Promise<string|null> => 'RH'), suspender: vi.fn(), aplicar: vi.fn(), revogar: vi.fn(), podeConferir: () => true,
    observar: vi.fn((_id: string,s:()=>void,c:(ok:boolean)=>void)=>{sinal=s;status=c;return vi.fn();}) };
  const v = criarVigiaAcesso(d);v.usuario('ficticio');
  return {v,d,sinal:()=>sinal(),status:(ok:boolean)=>status(ok)};
}
const tick=async()=>{await Promise.resolve();await Promise.resolve();};
it('sinal de revogação oculta antes da consulta e encerra acesso sem timer',async()=>{
  const x=montar();x.status(true);await tick();expect(x.d.aplicar).toHaveBeenCalledWith('RH');
  let responder!:(s:string|null)=>void;x.d.consultar.mockImplementation(()=>new Promise(r=>{responder=r}));
  x.d.suspender.mockClear();x.sinal();expect(x.d.suspender).toHaveBeenCalledOnce();
  responder(null);await tick();expect(x.d.revogar).toHaveBeenCalledOnce();
});
it('rebaixamento aplica Comercial sem recarregar',async()=>{
  const x=montar();x.status(true);await tick();x.d.consultar.mockResolvedValue('COMERCIAL');x.sinal();await tick();expect(x.d.aplicar).toHaveBeenLastCalledWith('COMERCIAL');
});
it('resposta antiga não desfaz revogação posterior',async()=>{
  const x=montar();x.status(true);await tick();let antigo!:(s:string|null)=>void;
  x.d.consultar.mockImplementationOnce(()=>new Promise(r=>{antigo=r})).mockResolvedValue(null);
  void x.v.conferir();x.sinal();await tick();x.d.aplicar.mockClear();antigo('RH');await tick();expect(x.d.aplicar).not.toHaveBeenCalled();expect(x.d.revogar).toHaveBeenCalled();
});
it('canal cai: oculta, não reabre com consulta isolada, reconecta e valida',async()=>{
  const x=montar();x.status(true);await tick();x.d.aplicar.mockClear();x.status(false);await x.v.conferir();expect(x.d.aplicar).not.toHaveBeenCalled();x.status(true);await tick();expect(x.d.aplicar).toHaveBeenCalledWith('RH');
});
it('erro de rede e logout descartam consultas pendentes',async()=>{
 const x=montar();x.status(true);await tick();x.d.aplicar.mockClear();x.d.consultar.mockRejectedValueOnce(Error('offline'));await x.v.conferir();expect(x.d.aplicar).not.toHaveBeenCalled();
 let responder!:(s:string|null)=>void;x.d.consultar.mockImplementation(()=>new Promise(r=>{responder=r}));void x.v.conferir();x.v.parar();responder('RH');await tick();expect(x.d.aplicar).not.toHaveBeenCalled();
});
it('retorno da rede recria canal, evitando ficar preso após queda breve',async()=>{
 const x=montar();x.status(true);await tick();x.d.aplicar.mockClear();x.v.desconectar();x.v.reconectar();
 expect(x.d.observar).toHaveBeenCalledTimes(2);await tick();expect(x.d.aplicar).not.toHaveBeenCalled();
 x.status(true);await tick();expect(x.d.aplicar).toHaveBeenCalledWith('RH');
});
